import https from "node:https";
import { z } from "zod";
import { normalizeUnifiHost, type UnifiConfig } from "./config";

export class UnifiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export const CameraSchema = z.object({ id: z.string(), name: z.string(), mac: z.string(), state: z.string(), type: z.string().nullable().optional(), featureFlags: z.object({ smartDetectTypes: z.array(z.string()).optional() }).passthrough().optional() }).passthrough();
export type ProtectCamera = { id: string; name: string; mac: string; state: string; model: string; faceRecognition: boolean };
export async function protectJson(config: UnifiConfig, path: string, fetchImpl?: typeof fetch): Promise<unknown> {
  const url = new URL(`/proxy/protect/integration/v1/${path}`, normalizeUnifiHost(config.host));
  let status: number; let body: string;
  try {
    if (fetchImpl) {
      const response = await fetchImpl(url, { headers: { "X-API-Key": config.token, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(10000) });
      status = response.status; body = await response.text();
    } else {
      ({ status, body } = await new Promise<{status: number; body: string}>((resolve, reject) => {
        // Certificate policy applies only to this connection, never to the process.
        const req = https.get(url, { headers: { "X-API-Key": config.token, Accept: "application/json" }, rejectUnauthorized: config.tlsVerify, timeout: 10000 }, res => {
          const chunks: Buffer[] = []; let size = 0;
          res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 2_000_000) req.destroy(new UnifiError("RESPONSE_TOO_LARGE", "Protect returned too much data")); else chunks.push(chunk); });
          res.on("error", reject);
          res.on("end", () => resolve({status: res.statusCode ?? 502, body: Buffer.concat(chunks).toString("utf8")}));
        });
        req.on("timeout", () => req.destroy(new UnifiError("TIMEOUT", "Protect did not respond within 10 seconds")));
        req.on("error", reject);
      }));
    }
  } catch (error) {
    if (error instanceof UnifiError) throw error;
    const code = (error as NodeJS.ErrnoException).code ?? "";
    if (/CERT|TLS|SSL|SELF_SIGNED/.test(code)) throw new UnifiError("CERTIFICATE", "The Protect certificate is not trusted. Check the console certificate or this connection's TLS setting.");
    throw new UnifiError("UNREACHABLE", "Cannot reach this Protect console. Check its address and network connection.");
  }
  if (status === 401 || status === 403) throw new UnifiError("API_KEY", "Protect rejected the API key. Use a Protect integration API key with access to this console.");
  if (status === 404) throw new UnifiError("NOT_PROTECT", "Protect integration API was not found at this address. Use the console running UniFi Protect.");
  if (status < 200 || status >= 300) throw new UnifiError("HTTP_ERROR", `Protect returned HTTP ${status}.`);
  try { return JSON.parse(body); } catch { throw new UnifiError("INVALID_RESPONSE", "This address returned a web page instead of the Protect API."); }
}
export async function inspectProtect(config: UnifiConfig, fetchImpl?: typeof fetch): Promise<{version: string; cameras: ProtectCamera[]}> {
  const info = z.object({applicationVersion: z.string()}).safeParse(await protectJson(config,"meta/info",fetchImpl));
  if (!info.success) throw new UnifiError("INVALID_RESPONSE", "Protect returned an unexpected application response.");
  const cameraResult = z.array(CameraSchema).safeParse(await protectJson(config,"cameras",fetchImpl));
  if (!cameraResult.success) throw new UnifiError("INVALID_RESPONSE", "Protect returned an unexpected camera list.");
  return { version: info.data.applicationVersion, cameras: cameraResult.data.map(c => ({id:c.id,name:c.name,mac:c.mac,state:c.state,model:c.type ?? "",faceRecognition:c.featureFlags?.smartDetectTypes?.includes("face") ?? false})) };
}
