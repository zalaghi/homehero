import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/csrf";
import { getPrisma } from "@/server/db/prisma";
export async function PATCH(req:Request,ctx:{params:Promise<{id:string}>}){
 await assertSameOrigin();const user=await getCurrentUser();if(user?.role!=="ADMIN")return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=z.object({action:z.enum(["APPROVE","DISMISS"])}).safeParse(await req.json().catch(()=>null));if(!body.success)return NextResponse.json({error:"Invalid input"},{status:400});
 const {id}=await ctx.params, db=getPrisma();
 try { await db.$transaction(async tx=>{
  const item=await tx.protectAttendanceSuggestion.findUnique({where:{id}});if(!item)throw new Error("Not found");
  if(item.status!=="PENDING")throw new Error("This observation was already reviewed");
  if(body.data.action==="APPROVE"){
   const paid=await tx.payPeriod.findFirst({where:{employeeId:item.employeeId,startDate:{lte:item.date},endDate:{gte:item.date},OR:[{status:"PAID"},{paidAt:{not:null}}]}});if(paid)throw new Error("This date belongs to a paid period. Review it in Attendance instead.");
   const existing=await tx.attendanceDay.findUnique({where:{employeeId_date:{employeeId:item.employeeId,date:item.date}}});
   if(existing?.source==="MANUAL" && !existing.worked)throw new Error("This day has a manual decision. Review it in Attendance instead.");
   await tx.attendanceDay.upsert({where:{employeeId_date:{employeeId:item.employeeId,date:item.date}},create:{employeeId:item.employeeId,date:item.date,worked:true,source:"MANUAL",manualOverrideByUserId:user.userId,uncertainty:false},update:{worked:true,source:"MANUAL",manualOverrideByUserId:user.userId,uncertainty:false}});
  }
  await tx.protectAttendanceSuggestion.update({where:{id},data:{status:body.data.action==="APPROVE"?"APPROVED":"DISMISSED",reviewedAt:new Date(),reviewedByUserId:user.userId}});
  await tx.auditLog.create({data:{actorUserId:user.userId,actorRole:"ADMIN",action:`PROTECT_ATTENDANCE_${body.data.action}`,entityType:"ProtectAttendanceSuggestion",entityId:id}});
 },{isolationLevel:"Serializable"});return NextResponse.json({ok:true});}
 catch(error){return NextResponse.json({error:error instanceof Error && !error.message.includes("\n") && error.message.length<150?error.message:"This review could not be saved. Refresh and try again."},{status:409});}
}
