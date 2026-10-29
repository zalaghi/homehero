import { z } from "zod";
import type { ProtectAttendanceRule } from "./config";
const Payload = z.object({alarm:z.object({name:z.string(),triggers:z.array(z.object({device:z.string(),key:z.string().optional()})).min(1).max(20)}),timestamp:z.number().int().positive()});
export type RecognitionObservation = {cameraId:string;cameraName:string;occurredAt:Date;date:string};
export function localDayAndSeconds(date:Date,timezone:string) {
  const parts = new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,seconds:Number(p.hour)*3600+Number(p.minute)*60+Number(p.second)};
}
export function recognitionObservation(payload:unknown,rule:ProtectAttendanceRule,now=new Date()):RecognitionObservation|null {
  if(!rule.enabled || !rule.recognitionConfirmed) return null;
  const parsed=Payload.safeParse(payload);
  if(!parsed.success || parsed.data.alarm.name!==rule.alarmName) return null;
  // This secret endpoint accepts an exact named-person alarm configured in Protect.
  // Identity comes from Protect's alarm condition; never use a generic Person alarm.
  const occurredAt=new Date(parsed.data.timestamp),age=now.getTime()-occurredAt.getTime();
  if(!Number.isFinite(occurredAt.getTime()) || age>15*60_000 || age < -30_000) return null;
  const camera=rule.camera;
  const matches=parsed.data.alarm.triggers.some(t=>t.device===camera.id || t.device.replace(/:/g,"").toLowerCase()===camera.mac.replace(/:/g,"").toLowerCase());
  if(!matches) return null;
  return {cameraId:camera.id,cameraName:camera.name,occurredAt,date:localDayAndSeconds(occurredAt,rule.timezone).date};
}
