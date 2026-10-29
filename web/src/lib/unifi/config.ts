import { z } from "zod";
export const AttendanceRule = z.object({
  enabled: z.boolean().default(false),
  employeeId: z.string().min(1).max(128),
  personName: z.string().trim().min(1).max(128),
  alarmName: z.string().trim().min(1).max(160),
  camera: z.object({id:z.string().min(1),mac:z.string().min(1),name:z.string().min(1)}),
  timezone: z.literal("Europe/Madrid").default("Europe/Madrid"),
  recognitionConfirmed: z.boolean().default(false),
}).refine(r=>!r.enabled || r.recognitionConfirmed,"Configure a named-person recognition alarm before enabling attendance review");
export type ProtectAttendanceRule = z.infer<typeof AttendanceRule>;
export type UnifiConfig = {host:string;token:string;tlsVerify:boolean;attendance?:ProtectAttendanceRule;webhookSecret?:string};
export function normalizeUnifiHost(host:string):string {
  const value=host.trim();
  const url=new URL(value.includes("://")?value:`https://${value}`);
  if(url.protocol!=="https:" || url.username || url.password || url.search || url.hash || (url.pathname!=="/" && url.pathname!=="")) throw new Error("Use the HTTPS console address without a path, username or password");
  return url.origin;
}
