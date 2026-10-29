import { getPrisma } from "@/server/db/prisma";
import { recognitionObservation } from "@/lib/unifi/recognition";
import type { ProtectAttendanceRule } from "@/lib/unifi/config";
export async function receiveRecognition(payload:unknown,rule:ProtectAttendanceRule,now=new Date()) {
  const observation=recognitionObservation(payload,rule,now);
  if(!observation) return {accepted:0,suggestion:false};
  // Unique employee + local date makes retries and repeated sightings idempotent.
  // Retain only one minimal observation per day, with no photographs or face templates.
  const created=await getPrisma().protectAttendanceSuggestion.createMany({data:[{
    employeeId:rule.employeeId,date:new Date(observation.date+"T00:00:00Z"),
    personName:rule.personName,alarmName:rule.alarmName,cameraName:observation.cameraName,seenAt:observation.occurredAt,
  }],skipDuplicates:true});
  // Only a separate explicit administrator review may write attendance.
  return {accepted:1,suggestion:created.count>0};
}
