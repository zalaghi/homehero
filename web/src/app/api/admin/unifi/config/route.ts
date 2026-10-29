import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AttendanceRule, normalizeUnifiHost, type UnifiConfig } from "@/lib/unifi/config";
import { assertSameOrigin } from "@/server/security/csrf";
import { getCurrentUser } from "@/server/auth/session";
import { getUnifiConfig, getUnifiConfigSummary, saveUnifiConfig } from "@/server/unifi/config";
import { getPrisma } from "@/server/db/prisma";
import { inspectProtect } from "@/lib/unifi/protect";
import { logAudit } from "@/server/audit/log";
const Body=z.object({host:z.string().min(1),token:z.string().optional(),tlsVerify:z.boolean(),attendance:AttendanceRule.optional()});
export async function GET(req:Request) {
 const user=await getCurrentUser();if(user?.role!=="ADMIN")return NextResponse.json({error:"Unauthorized"},{status:401});
 if(new URL(req.url).searchParams.get("webhook")==="true"){
  const cfg=await getUnifiConfig();const origin=(process.env.APP_ORIGIN??new URL(req.url).origin).split(",")[0].trim();
  return NextResponse.json({url:cfg?.webhookSecret?`${origin}/api/integrations/unifi/protect/${cfg.webhookSecret}`:null});
 }
 return NextResponse.json(await getUnifiConfigSummary());
}
export async function POST(req:Request) {
 await assertSameOrigin();const user=await getCurrentUser();if(user?.role!=="ADMIN")return NextResponse.json({error:"Unauthorized"},{status:401});
 const parsed=Body.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Invalid input"},{status:400});
 const stored=await getUnifiConfig();let host:string;
 try{host=normalizeUnifiHost(parsed.data.host)}catch{return NextResponse.json({error:"Use the HTTPS console address without a path"},{status:400})}
 if(!parsed.data.token?.trim() && stored && host!==normalizeUnifiHost(stored.host))return NextResponse.json({error:"Enter the API key for the new console address"},{status:400});
 const rule=parsed.data.attendance ?? stored?.attendance;
 if(rule && !await getPrisma().employee.findUnique({where:{id:rule.employeeId},select:{id:true}}))return NextResponse.json({error:"Employee not found"},{status:400});
 const payload:UnifiConfig={...stored,host,token:parsed.data.token?.trim()||stored?.token||"",tlsVerify:parsed.data.tlsVerify,attendance:rule,webhookSecret:stored?.webhookSecret??crypto.randomBytes(32).toString("base64url")};
 if(!payload.token)return NextResponse.json({error:"Missing API key"},{status:400});
 if(rule?.enabled){
  try {
   const info=await inspectProtect(payload);
   if(!info.cameras.some(c=>c.id===rule.camera.id && c.mac.replace(/:/g,"").toLowerCase()===rule.camera.mac.replace(/:/g,"").toLowerCase() && c.faceRecognition))return NextResponse.json({error:"Choose a camera with facial recognition before enabling daily suggestions"},{status:400});
  }catch{return NextResponse.json({error:"Verify the Protect connection before enabling daily suggestions"},{status:400})}
 }
 await saveUnifiConfig(payload);
 await logAudit({actorUserId:user.userId,actorRole:"ADMIN",action:"PROTECT_CONFIG_UPDATE",entityType:"AppSetting",metadata:{attendanceEnabled:rule?.enabled??false}});
 return NextResponse.json({ok:true});
}
