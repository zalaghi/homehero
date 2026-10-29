"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ProtectCamera } from "@/lib/unifi/protect";
import type { ProtectAttendanceRule } from "@/lib/unifi/config";
import AppIcon from "@/components/AppIcon";
type Suggestion={id:string;employeeId:string;employeeName:string;date:string;personName:string;cameraName:string;seenAt:string};
export default function UnifiSettingsForm(props:{initial:{host:string|null;tlsVerify:boolean|null;hasToken:boolean;attendance:ProtectAttendanceRule|null;webhookConfigured:boolean;lastWebhookReceivedAt:string|null};employees:{id:string;name:string}[];suggestions:Suggestion[];locale:string}){
 const t=useTranslations("admin.unifi"), c=useTranslations("common"), router=useRouter();
 const [host,setHost]=useState(props.initial.host??""),[token,setToken]=useState(""),[tlsVerify,setTlsVerify]=useState(props.initial.tlsVerify??true);
 const [status,setStatus]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[connection,setConnection]=useState<{version:string;cameras:ProtectCamera[]}|null>(null);
 const rule=props.initial.attendance;
 const [employeeId,setEmployeeId]=useState(rule?.employeeId??""),[personName,setPersonName]=useState(rule?.personName??""),[alarmName,setAlarmName]=useState(rule?.alarmName??"HomeHero attendance"),[cameraId,setCameraId]=useState(rule?.camera.id??"");
 const [enabled,setEnabled]=useState(rule?.enabled??false),[recognitionConfirmed,setRecognitionConfirmed]=useState(rule?.recognitionConfirmed??false),[webhook,setWebhook]=useState<string|null>(null),[copied,setCopied]=useState(false);
 const cameras=connection?.cameras??(rule?[rule.camera].map(camera=>({...camera,state:"",model:"",faceRecognition:false})):[]);
 const input="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-sm dark:border-white/15 dark:bg-zinc-900";
 const button="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50";
 async function perform(action:"test"|"save"|"rule"){
  setBusy(true);setStatus(null);setError(null);
  try{
   let attendance:ProtectAttendanceRule|undefined;
   if(action==="rule"){
    const a=cameras.find(c=>c.id===cameraId);if(!a||!employeeId||!personName.trim()||!alarmName.trim())throw new Error(t("protect.required"));
    const asCamera=({id,mac,name}:ProtectCamera)=>({id,mac,name});
    attendance={enabled,employeeId,personName:personName.trim(),alarmName:alarmName.trim(),camera:asCamera(a),timezone:"Europe/Madrid",recognitionConfirmed};
   }
   const res=await fetch(`/api/admin/unifi/${action==="test"?"test":"config"}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({host,token:token.trim()||undefined,tlsVerify,...(attendance?{attendance}:{})})});
   const body=await res.json();if(!res.ok)throw new Error(body.error??t("errors.connect"));
   if(action==="test"){
    setConnection(body);setStatus(t("protect.connected",{version:body.version,count:body.cameras.length}));
    if(!cameraId)setCameraId(body.cameras.find((c:ProtectCamera)=>c.name==="cam-salon")?.id??"");
   }else{setToken("");setStatus(t("messages.saved"));router.refresh();}
  }catch(e){setError(e instanceof Error?e.message:t("errors.connect"))}finally{setBusy(false)}
 }
 async function review(id:string,action:"APPROVE"|"DISMISS"){
  setBusy(true);setError(null);try{const res=await fetch(`/api/admin/unifi/suggestions/${id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action})});const body=await res.json();if(!res.ok)throw new Error(body.error);router.refresh()}catch(e){setError(e instanceof Error?e.message:t("errors.save"))}finally{setBusy(false)}
 }
 return <div className="space-y-5">
  <div aria-live="polite">{status&&<p className="rounded-xl border border-emerald-600/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200">{status}</p>}{error&&<p role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">{error}</p>}</div>
  <div className="grid items-start gap-5 xl:grid-cols-2">
   <section className="space-y-4 rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950">
    <div className="flex items-center gap-3"><span className="hh-summary-icon"><AppIcon name="camera" className="h-5 w-5" /></span><div><h2 className="font-semibold">UniFi Protect</h2><p className="text-xs text-zinc-500">{t("protect.connectionHint")}</p></div></div>
    <label className="block space-y-1 text-sm font-medium"><span>{t("fields.host")}</span><input className={input} dir="ltr" value={host} onChange={e=>setHost(e.target.value)} disabled={busy} placeholder="https://192.168.0.3" /></label>
    <label className="block space-y-1 text-sm font-medium"><span>{t("fields.token")}</span><input className={input} type="password" autoComplete="new-password" value={token} onChange={e=>setToken(e.target.value)} disabled={busy} placeholder={props.initial.hasToken?t("placeholders.tokenStored"):t("placeholders.token")} /><span className="block text-xs font-normal text-zinc-500">{t("helpers.token")}</span></label>
    <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={tlsVerify} onChange={e=>setTlsVerify(e.target.checked)} disabled={busy} />{t("fields.tlsVerify")}</label>
    <div className="flex flex-wrap gap-2"><button className={button} onClick={()=>void perform("test")} disabled={busy}>{busy?c("loading"):t("actions.test")}</button><button className="rounded-xl border border-black/10 px-4 py-3 text-sm font-medium dark:border-white/15" onClick={()=>void perform("save")} disabled={busy}>{c("save")}</button></div>
    <p className="rounded-xl bg-black/5 p-3 text-xs leading-relaxed text-zinc-600 dark:bg-white/5 dark:text-zinc-300">{props.initial.lastWebhookReceivedAt?t("protect.lastDelivery",{time:new Date(props.initial.lastWebhookReceivedAt).toLocaleString(props.locale,{timeZone:"Europe/Madrid"})}):t("protect.noDelivery")}</p>
    {connection&&<div className="divide-y divide-black/5 dark:divide-white/10">{connection.cameras.map(camera=><div key={camera.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{camera.name}</div><p className="mt-1 text-xs text-zinc-500">{camera.model} · {camera.faceRecognition?t("protect.face"):t("protect.personOnly")}</p></div><span className={`h-2 w-2 shrink-0 rounded-full ${camera.state==="CONNECTED"?"bg-emerald-500":"bg-amber-500"}`} title={camera.state} aria-label={camera.state} /></div>)}</div>}
   </section>
   <section className="space-y-4 rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950">
    <h2 className="font-semibold">{t("protect.attendanceTitle")}</h2><p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("protect.ruleDescription")}</p>
    <label className="block space-y-1 text-sm"><span>{t("protect.employee")}</span><select className={input} value={employeeId} onChange={e=>{setEmployeeId(e.target.value);setRecognitionConfirmed(false);setEnabled(false)}}><option value="">{t("protect.choose")}</option>{props.employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
    <label className="block space-y-1 text-sm"><span>{t("protect.personName")}</span><input className={input} value={personName} onChange={e=>{setPersonName(e.target.value);setRecognitionConfirmed(false);setEnabled(false)}} /></label>
    <label className="block space-y-1 text-sm"><span>{t("protect.camera")}</span><select className={input} value={cameraId} disabled={!cameras.length} onChange={e=>{setCameraId(e.target.value);setRecognitionConfirmed(false);setEnabled(false)}}><option value="">{t("protect.choose")}</option>{cameras.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-medium text-emerald-800 dark:text-emerald-200">{t("protect.dayWindow")} · Europe/Madrid</p>
    <label className="block space-y-1 text-sm"><span>{t("protect.alarmName")}</span><input className={input} value={alarmName} onChange={e=>{setAlarmName(e.target.value);setRecognitionConfirmed(false);setEnabled(false)}} /></label>
    <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">{t("protect.recognitionHelp")}</p>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 shrink-0" checked={recognitionConfirmed} onChange={e=>{setRecognitionConfirmed(e.target.checked);if(!e.target.checked)setEnabled(false)}} /><span>{t("protect.confirmRecognition")}</span></label>
    <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={enabled} disabled={!recognitionConfirmed} onChange={e=>setEnabled(e.target.checked)} />{t("protect.enable")}</label>
    <button className={button} disabled={busy} onClick={()=>void perform("rule")}>{c("save")}</button>
    <details className="border-t border-black/10 pt-4 dark:border-white/10"><summary className="cursor-pointer text-sm font-semibold">{t("protect.setup")}</summary><ol className="mt-3 list-decimal space-y-3 ps-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"><li>{t("protect.step1")}</li><li>{t("protect.step2")}</li><li>{t("protect.step3")}</li></ol><button className="mt-4 rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/10" disabled={busy} onClick={async()=>{try{const r=await fetch("/api/admin/unifi/config?webhook=true");if(!r.ok)throw new Error();const b=await r.json();if(!b.url){setError(t("protect.saveFirst"));return}setWebhook(b.url)}catch{setError(t("errors.save"))}}}>{t("protect.webhook")}</button>{webhook&&<div className="mt-3 flex gap-2"><input readOnly type="password" className={input} value={webhook} aria-label={t("protect.webhook")} /><button className={button} onClick={async()=>{try{await navigator.clipboard.writeText(webhook);setCopied(true)}catch{setError(t("errors.save"))}}}>{copied?t("protect.copied"):t("protect.copy")}</button></div>}</details>
   </section>
  </div>
  <section className="rounded-2xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-950"><h2 className="font-semibold">{t("protect.reviewTitle")}</h2><p className="mt-1 text-sm text-zinc-500">{t("protect.reviewHelp")}</p>{props.suggestions.length===0?<p className="mt-4 rounded-xl border border-dashed border-black/10 p-5 text-center text-sm text-zinc-500 dark:border-white/10">{t("protect.noSuggestions")}</p>:<div className="mt-4 space-y-3">{props.suggestions.map(s=><div key={s.id} className="rounded-xl border border-black/10 p-4 dark:border-white/10"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{s.employeeName}</strong><span className="text-sm">{s.date}</span></div><p className="mt-2 text-sm">{s.personName}: {s.cameraName}</p><p className="mt-1 text-xs text-zinc-500">{new Date(s.seenAt).toLocaleTimeString(props.locale,{timeZone:"Europe/Madrid"})} · Europe/Madrid</p><div className="mt-3 flex flex-wrap gap-2"><Link className="rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/15" href={`/${props.locale}/admin/employees/${s.employeeId}/attendance`}>{t("protect.openAttendance")}</Link><button className={button} disabled={busy} onClick={()=>void review(s.id,"APPROVE")}>{t("protect.approve")}</button><button className="rounded-xl px-3 py-2 text-sm text-zinc-500" disabled={busy} onClick={()=>void review(s.id,"DISMISS")}>{t("protect.dismiss")}</button></div></div>)}</div>}</section>
 </div>;
}
