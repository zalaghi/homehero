import { describe, it, expect, vi } from "vitest";
import { inspectProtect, protectJson } from "../protect";
import { normalizeUnifiHost } from "../config";
const cfg={host:"https://protect.test",token:"fixture-key",tlsVerify:false};
describe("Protect connection",()=>{
 it("uses the official Protect endpoint and API-key header",async()=>{const mock=vi.fn().mockResolvedValueOnce(new Response('{"applicationVersion":"7.3.70"}')).mockResolvedValueOnce(new Response('[{"id":"one","mac":"aabb","name":"Kitchen","state":"CONNECTED","featureFlags":{"smartDetectTypes":["person"]}}]'));const result=await inspectProtect(cfg,mock);expect(String(mock.mock.calls[0][0])).toBe("https://protect.test/proxy/protect/integration/v1/meta/info");expect(mock.mock.calls[0][1].headers["X-API-Key"]).toBe("fixture-key");expect(result.cameras[0].faceRecognition).toBe(false);expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).not.toBe("0")});
 it.each([[401,"API_KEY"],[403,"API_KEY"],[404,"NOT_PROTECT"],[500,"HTTP_ERROR"]])("explains status %i",async(status,code)=>{await expect(protectJson(cfg,"meta/info",vi.fn().mockResolvedValue(new Response("{}",{status:Number(status)})))).rejects.toMatchObject({code})});
 it("rejects a login page returned with HTTP 200",async()=>{await expect(protectJson(cfg,"meta/info",vi.fn().mockResolvedValue(new Response("<html>Login</html>")))).rejects.toMatchObject({code:"INVALID_RESPONSE"})});
 it("rejects unexpected camera data",async()=>{const mock=vi.fn().mockResolvedValueOnce(new Response('{"applicationVersion":"7"}')).mockResolvedValueOnce(new Response('{}'));await expect(inspectProtect(cfg,mock)).rejects.toMatchObject({code:"INVALID_RESPONSE"})});
 it.each(["http://console.test","https://user:pass@console.test","https://console.test/path","https://console.test?key=x"])("rejects unsafe console format %s",host=>{expect(()=>normalizeUnifiHost(host)).toThrow()});
 it("normalizes local console addresses",()=>{expect(normalizeUnifiHost("192.168.0.3/")).toBe("https://192.168.0.3")});
});
