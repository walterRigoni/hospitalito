const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module'),{webcrypto}=require('node:crypto');
const logic=stripTypeScriptTypes(fs.readFileSync(__dirname+'/../supabase/functions/hospitalito-telemed/logic.ts','utf8'),{mode:'strip'}).replace(/^export /gm,''),source=stripTypeScriptTypes(fs.readFileSync(__dirname+'/../supabase/functions/hospitalito-telemed/index.ts','utf8'),{mode:'strip'}).replace(/^import .*$/gm,'');
let actorRole='medico',actorName='doctor',queries=[],rpcCalls=[];
const visit={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',provider:'doctor',client:'patient',status:'confirmed',mode:'office',payment_model:'split_full'};
const profile={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',username:'doctor',role:'medico',public_visible:true,bank_public:{visible:false,cbu:'0000000000000000000000'},modes:{office:{enabled:true,rates:[{minutes:15,amount_cents:200000}]}}};
function from(table){let filters=[],single=false;const q={insert(){return q},select(){return q},eq(k,v){filters.push([k,v]);return q},neq(k,v){filters.push(['not '+k,v]);return q},in(){return q},order(){return q},limit(){return q},maybeSingle(){single=true;return q},single(){single=true;return q},then(resolve){queries.push({table,filters});let data;
if(table==='hc_auth_sessions')data={username:actorName,expires_at:new Date(Date.now()+3600000).toISOString()};
else if(table==='hc_auth_users')data=single?{username:actorName,name:'FICTICIO',active:true,default_role:actorRole,is_global_admin:false}:[{username:'doctor',name:'FICTICIO',active:true,default_role:'medico',profile:{}}];
else if(table==='hc_tele_visits')data=filters.some(([k])=>k==='request_id')?null:visit;
else if(table==='hc_tele_profiles')data=single?{username:'doctor'}:[profile];
else if(table==='hc_tele_settings')data={enabled:false,commission_bps:2000};
else if(table==='hc_tele_sellers')data=single?null:[];
else if(table==='hc_tele_notes')data=single?null:[];
else data=[];
resolve({data,error:null});}};return q;}
const db={from,rpc(name,args){rpcCalls.push({name,args});return Promise.resolve({data:name==='hc297_save_note'?{revision:1,record:args.entry}:name==='hc297_available_slots'?[{available:true}]:true,error:null})}};
let handler;const c={Request,Response,URL,URLSearchParams,AbortSignal,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,console:{error(){}},atob,btoa,createClient:()=>db,Deno:{env:{get:k=>k==='SUPABASE_PUBLISHABLE_KEYS'?'{"default":"TEST"}':k==='SUPABASE_SECRET_KEYS'?'{"default":"TEST-SERVICE"}':''},serve:f=>handler=f}};vm.createContext(c);vm.runInContext(logic+'\n'+source,c);
async function call(action,payload={}){queries=[];rpcCalls=[];return (await handler(new Request('https://example.test/',{method:'POST',headers:{apikey:'TEST'},body:JSON.stringify({action,token:'FAKE',...payload})}))).json();}
(async()=>{
let j=await call('directory');assert(j.ok);assert.equal(j.providers.length,1);assert.equal(j.providers[0].bank_public.cbu,undefined);console.log('PASS independent directory and private banking visibility');
actorRole='cliente';actorName='patient';j=await call('clinicalRecord',{visitId:visit.id});assert(!j.ok);assert(!queries.some(q=>q.table==='hc_tele_notes'));console.log('PASS client cannot read private clinical notes');
actorRole='medico';actorName='other';j=await call('saveClinicalRecord',{visitId:visit.id,revision:0,record:{assessment:'FICTICIO'}});assert(!j.ok);assert(!rpcCalls.some(r=>r.name==='hc297_save_note'));console.log('PASS other doctor cannot write notes');
actorName='doctor';j=await call('clinicalRecord',{visitId:visit.id});assert(j.ok);assert(queries.some(q=>q.table==='hc_tele_notes'&&q.filters.some(([k,v])=>k==='provider'&&v==='doctor')&&q.filters.some(([k,v])=>k==='client'&&v==='patient')));console.log('PASS longitudinal notes scoped to doctor and patient');
j=await call('saveClinicalRecord',{visitId:visit.id,revision:0,record:{assessment:'FICTICIO'},actor_name:'other'});assert(j.ok);assert.equal(rpcCalls.find(r=>r.name==='hc297_save_note').args.actor_name,'doctor');console.log('PASS note author comes from authenticated session');
j=await call('saveProfile',{profile:{}});assert(!j.ok&&j.error.includes('Actualizá'));console.log('PASS stale combined agenda editor blocked');
j=await call('availability',{providers:[profile.id],mode:'office',date:'2026-11-20'});assert(j.ok&&j.providers[0].available);console.log('PASS batch availability');
console.log('7 API integration checks passed with fictitious identities');
})().catch(e=>{console.error(e);process.exit(1)});
