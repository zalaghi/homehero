import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getUnifiConfig } from "@/server/unifi/config";
import { receiveRecognition } from "@/server/unifi/recognition";
import { getPrisma } from "@/server/db/prisma";
import { rateLimitFixedWindow } from "@/server/security/rateLimit";
export async function POST(req:Request,ctx:{params:Promise<{secret:string}>}) {
 const {secret}=await ctx.params,config=await getUnifiConfig();
 const digest=(s:string)=>crypto.createHash("sha256").update(s).digest();
 if(!config?.webhookSecret || !crypto.timingSafeEqual(digest(secret),digest(config.webhookSecret))) return NextResponse.json({error:"Unauthorized"},{status:401});

 const rate=await rateLimitFixedWindow({key:"unifi:protect:callback",limit:120,windowSeconds:60});
 if(!rate.ok) return NextResponse.json({error:"Too many requests"},{status:429});
 // Record only authenticated delivery time, never the secret, photos or raw payload.
 await getPrisma().appSetting.upsert({where:{key:"unifi-protect-last-delivery"},create:{key:"unifi-protect-last-delivery",value:new Date().toISOString()},update:{value:new Date().toISOString()}});
 if(!config.attendance?.enabled) return NextResponse.json({accepted:0,reason:"disabled"});
 const reader=req.body?.getReader(); if(!reader) return NextResponse.json({error:"Missing payload"},{status:400});
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();return NextResponse.json({error:"Payload too large"},{status:413})}chunks.push(value);}
 let data:unknown;try{data=JSON.parse(Buffer.concat(chunks).toString("utf8"))}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
 try {return NextResponse.json(await receiveRecognition(data,config.attendance))} catch {return NextResponse.json({error:"Unable to record observation"},{status:503})}
}
