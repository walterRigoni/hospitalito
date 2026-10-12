import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type, apikey',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store'
};
const R=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:CORS});
function requireKey(req:Request){
  let keys:any={}; try{keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}')}catch{}
  const given=String(req.headers.get('apikey')||'');
  if(!given || !Object.values(keys).map(String).includes(given)) throw new Error('Aplicación no autorizada.');
}
function db(){
  let keys:any={}; try{keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')}catch{}
  const secret=String(keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
  return createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
const hx=(a:Uint8Array)=>[...a].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sha(s:string){return hx(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))))}

type Actor={key:string,kind:'seed'|'user',username:string,name:string,role:string,institutionId:string};
const actorCache=new Map<string,{until:number,value:Actor}>();
async function actor(c:any,token:string,i:string):Promise<Actor>{
  if(!token||!i)throw new Error('Falta sesión o institución.');
  const h=await sha(token),ck=h+'|'+i,now=Date.now(),cached=actorCache.get(ck);if(cached&&cached.until>now)return cached.value;
  const [seedR,authR]=await Promise.all([
    c.from('hc_seed_sessions').select('institution_id,expires_at').eq('token_hash',h).maybeSingle(),
    c.from('hc_auth_sessions').select('username,expires_at').eq('token_hash',h).maybeSingle()
  ]);
  const seed=seedR.data;
  if(seed&&Date.parse(seed.expires_at)>now){
    if(String(seed.institution_id)!==i)throw new Error('El admin semilla sólo puede usar su institución vinculada.');
    const a:Actor={key:`seed:${i}`,kind:'seed',username:'admin',name:'Admin semilla',role:'admin',institutionId:i};actorCache.set(ck,{until:now+8000,value:a});return a;
  }
  const s=authR.data;if(!s||Date.parse(s.expires_at)<=now)throw new Error('Sesión vencida.');
  const [uR,mR]=await Promise.all([
    c.from('hc_auth_users').select('username,name,default_role,active,is_global_admin').eq('username',s.username).maybeSingle(),
    c.from('hc_auth_memberships').select('role,active').eq('username',s.username).eq('institution_id',i).maybeSingle()
  ]);
  const u=uR.data,m=mR.data;if(!u?.active)throw new Error('Usuario inactivo.');if(u.is_global_admin)throw new Error('La cuenta de plataforma no participa en llamadas institucionales.');if(!m?.active)throw new Error('No tenés acceso a esta institución.');
  const a:Actor={key:`user:${u.username}`,kind:'user',username:String(u.username),name:String(u.name||u.username),role:String(m.role||u.default_role||''),institutionId:i};actorCache.set(ck,{until:now+8000,value:a});return a;
}
async function members(c:any,i:string){
  const {data,error}=await c.from('hc_auth_memberships').select('username,role,hc_auth_users(username,name,active)').eq('institution_id',i).eq('active',true);if(error)throw error;
  const rows=(data||[]).filter((x:any)=>x.hc_auth_users?.active!==false).map((x:any)=>({key:`user:${x.username}`,username:String(x.username),name:String(x.hc_auth_users?.name||x.username),role:String(x.role||''),kind:'user'}));
  rows.unshift({key:`seed:${i}`,username:'admin',name:'Admin semilla',role:'admin',kind:'seed'});return rows;
}
async function call(c:any,id:string,i:string){const {data,error}=await c.from('hc_calls').select('*').eq('id',id).eq('institution_id',i).maybeSingle();if(error)throw error;if(!data)throw new Error('Llamada no encontrada.');return data;}
async function parts(c:any,id:string){const {data,error}=await c.from('hc_call_participants').select('*').eq('call_id',id).order('invited_at');if(error)throw error;return data||[];}
async function participant(c:any,id:string,key:string){const {data,error}=await c.from('hc_call_participants').select('*').eq('call_id',id).eq('participant_key',key).maybeSingle();if(error)throw error;return data;}
async function repairPresenter(c:any,x:any){
  if(!x||x.status!=='active')return x;
  const current=await participant(c,x.id,String(x.presenter_key||''));
  if(current?.joined_at&&!current?.left_at&&!current?.removed_at)return x;
  const {data,error}=await c.from('hc_call_participants').select('participant_key').eq('call_id',x.id).not('joined_at','is',null).is('left_at',null).is('removed_at',null).order('invited_at').limit(1);if(error)throw error;
  const next=data?.[0]?.participant_key;if(next){await c.from('hc_calls').update({presenter_key:next,updated_at:new Date().toISOString()}).eq('id',x.id);return {...x,presenter_key:next};}
  return x;
}
async function access(c:any,a:Actor,id:string){let x=await call(c,id,a.institutionId);if(x.status!=='active')throw new Error('La llamada finalizó.');const p=await participant(c,id,a.key);if(p?.removed_at)throw new Error('El presentador te retiró de la llamada.');if(!x.open_to_institution&&!p)throw new Error('No estás invitado a esta llamada.');x=await repairPresenter(c,x);return x;}
function requirePresenter(x:any,a:Actor){if(String(x.presenter_key)!==a.key)throw new Error('Esta acción es exclusiva del presentador actual.');}
async function clearPeerSignals(c:any,callId:string,peerKey:string){await c.from('hc_call_signals').delete().eq('call_id',callId).or(`from_key.eq.${peerKey},to_key.eq.${peerKey}`);}
async function notify(c:any,u:string,title:string,body:string,payload:any){try{await c.from('hc_notifications').insert({username:u,kind:'call',title,body,payload});}catch{}}
async function cleanupStale(c:any,i:string){
  const cutoff=new Date(Date.now()-45000).toISOString(),now=new Date().toISOString();const {data:active}=await c.from('hc_calls').select('*').eq('institution_id',i).eq('status','active');
  for(let x of active||[]){
    await c.from('hc_call_participants').update({left_at:now}).eq('call_id',x.id).is('left_at',null).is('removed_at',null).not('joined_at','is',null).lt('last_seen_at',cutoff);
    const {data:alive}=await c.from('hc_call_participants').select('participant_key').eq('call_id',x.id).not('joined_at','is',null).is('left_at',null).is('removed_at',null).gte('last_seen_at',cutoff).order('invited_at');
    if(!(alive||[]).length){await c.from('hc_calls').update({status:'ended',ended_at:now,updated_at:now}).eq('id',x.id).eq('status','active');await c.from('hc_call_signals').delete().eq('call_id',x.id);continue;}
    if(!(alive||[]).some((p:any)=>p.participant_key===x.presenter_key)){await c.from('hc_calls').update({presenter_key:alive![0].participant_key,updated_at:now}).eq('id',x.id);}
  }
}
async function activeOne(c:any,i:string){await cleanupStale(c,i);const {data,error}=await c.from('hc_calls').select('*').eq('institution_id',i).eq('status','active').order('created_at',{ascending:false}).limit(1);if(error)throw error;if(!data?.length)return null;const x=await repairPresenter(c,data[0]);return {...x,participants:await parts(c,x.id)};}
async function addParticipants(c:any,x:any,a:Actor,invitees:string[]){
  const all=await members(c,a.institutionId),map=new Map(all.map((m:any)=>[m.key,m])),keys=new Set([a.key,...invitees.filter(k=>map.has(k))]),now=new Date().toISOString();
  const rows=[...keys].map(k=>{const m:any=map.get(k)||a;return{call_id:x.id,participant_key:k,username:m.kind==='user'?m.username:'admin',display_name:m.name,role:m.role||'',joined_at:k===a.key?now:null,left_at:null,last_seen_at:k===a.key?now:new Date(0).toISOString(),mic_allowed:true,camera_allowed:true,removed_at:null,removed_by_key:null}});
  const {error}=await c.from('hc_call_participants').upsert(rows,{onConflict:'call_id,participant_key'});if(error)throw error;
  for(const k of keys){const m:any=map.get(k);if(k!==a.key&&m?.kind==='user')await notify(c,m.username,`Llamada de ${a.name}`,String(x.title||'Llamada Hospitalito'),{callId:x.id,institutionId:a.institutionId});}
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method!=='POST')return R({ok:false,error:'Método no permitido.'},405);
  try{
    requireKey(req);const raw=await req.text();if(raw.length>250000)return R({ok:false,error:'Solicitud demasiado grande.'},413);const b=JSON.parse(raw||'{}'),c=db(),act=String(b.action||''),i=String(b.institutionId||''),a=await actor(c,String(b.token||''),i);
    if(act==='rtcConfig'){
 const urls=String(Deno.env.get('HC_TURN_URLS')||'').split(',').map(x=>x.trim()).filter(x=>/^turns?:/.test(x)),secret=Deno.env.get('HC_TURN_SECRET')||'';
 const iceServers:any[]=[{urls:['stun:stun.l.google.com:19302','stun:stun.cloudflare.com:3478']}];
 const cfKey=Deno.env.get('HC_TURN_CF_KEY_ID')||'',cfToken=Deno.env.get('HC_TURN_CF_API_TOKEN')||'';
 if(cfKey&&cfToken){const res=await fetch('https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(cfKey)+'/credentials/generate-ice-servers',{method:'POST',headers:{Authorization:'Bearer '+cfToken,'Content-Type':'application/json'},body:JSON.stringify({ttl:3600}),signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('El servicio de relevo no pudo generar la conexión. Revisá su configuración.');const j=await res.json(),servers=Array.isArray(j.iceServers)?j.iceServers:[];if(!servers.some((x:any)=>(Array.isArray(x.urls)?x.urls:[x.urls]).some((u:any)=>/^turns?:/.test(String(u)))))throw Error('El servicio de relevo devolvió una conexión inválida.');iceServers.push(...servers);}
 if(urls.length&&secret){const username=String(Math.floor(Date.now()/1000)+3600)+':'+a.key,key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']),sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username))),credential=btoa(String.fromCharCode(...sig));iceServers.push({urls,username,credential})}
 return R({ok:true,relayConfigured:iceServers.length>1,rtcConfig:{iceServers,iceCandidatePoolSize:2}});
 }
 if(act==='activeCalls'){const x=await activeOne(c,i);return R({ok:true,calls:x?[x]:[]});}
    if(act==='createCall'){
      const title=String(b.title||'Ateneo / llamada Hospitalito').slice(0,160),invitees=Array.isArray(b.invitees)?b.invitees.map(String):[];let x=await activeOne(c,i),reused=!!x;
      if(!x){const ins=await c.from('hc_calls').insert({institution_id:i,title,created_by_key:a.key,created_by_name:a.name,presenter_key:a.key,status:'active',open_to_institution:true}).select('*').single();if(ins.error){if(String(ins.error.code||'')==='23505'){x=await activeOne(c,i);reused=true;}else throw ins.error;}else x=ins.data;}
      if(!x)throw new Error('No se pudo crear la llamada.');await addParticipants(c,x,a,invitees);x=await call(c,x.id,i);return R({ok:true,reused,call:{...x,participants:await parts(c,x.id)},signalCursor:0});
    }
    if(act==='joinCall'){
      const x=await access(c,a,String(b.callId||'')),now=new Date().toISOString(),old=await participant(c,x.id,a.key);if(old?.removed_at)throw new Error('El presentador te retiró de la llamada.');await clearPeerSignals(c,x.id,a.key);
      const {error}=await c.from('hc_call_participants').upsert({call_id:x.id,participant_key:a.key,username:a.kind==='user'?a.username:'admin',display_name:a.name,role:a.role,joined_at:now,left_at:null,last_seen_at:now,mic_enabled:true,camera_enabled:true,screen_sharing:false,mic_allowed:true,camera_allowed:true,removed_at:null,removed_by_key:null},{onConflict:'call_id,participant_key'});if(error)throw error;
      const xr=await repairPresenter(c,await call(c,x.id,i));return R({ok:true,call:{...xr,participants:await parts(c,x.id)},signalCursor:0});
    }
    if(act==='callPulse'){
      const x=await access(c,a,String(b.callId||'')),after=Math.max(0,Number(b.afterId||0)),now=new Date().toISOString();await c.from('hc_call_participants').update({last_seen_at:now}).eq('call_id',x.id).eq('participant_key',a.key).is('left_at',null).is('removed_at',null);
      const [pp,sg]=await Promise.all([c.from('hc_call_participants').select('*').eq('call_id',x.id).order('invited_at'),c.from('hc_call_signals').select('*').eq('call_id',x.id).eq('to_key',a.key).gt('id',after).order('id').limit(500)]);if(pp.error)throw pp.error;if(sg.error)throw sg.error;
      const signals=sg.data||[],lastId=signals.reduce((m:any,s:any)=>Math.max(m,Number(s.id||0)),after);return R({ok:true,call:{...x,participants:pp.data||[]},signals,lastId});
    }
    if(act==='sendSignal'){
      const x=await access(c,a,String(b.callId||'')),to=String(b.toKey||''),kind=String(b.kind||'');if(!['offer','answer','ice','renegotiate'].includes(kind))throw new Error('Señal inválida.');const p=await participant(c,x.id,to);if(!p||!p.joined_at||p.left_at||p.removed_at)throw new Error('El otro participante todavía no está en la llamada.');const {data,error}=await c.from('hc_call_signals').insert({call_id:x.id,from_key:a.key,to_key:to,kind,payload:b.payload||{}}).select('id').single();if(error)throw error;return R({ok:true,id:data.id});
    }
    if(act==='updateCallMedia'){
      const x=await access(c,a,String(b.callId||'')),me=await participant(c,x.id,a.key);if(!me)throw new Error('Participante no encontrado.');const patch:any={last_seen_at:new Date().toISOString()};
      if(Object.prototype.hasOwnProperty.call(b,'mic_enabled'))patch.mic_enabled=!!b.mic_enabled&&me.mic_allowed!==false;
      if(Object.prototype.hasOwnProperty.call(b,'camera_enabled'))patch.camera_enabled=!!b.camera_enabled&&me.camera_allowed!==false;
      if(Object.prototype.hasOwnProperty.call(b,'screen_sharing'))patch.screen_sharing=!!b.screen_sharing;
      await c.from('hc_call_participants').update(patch).eq('call_id',x.id).eq('participant_key',a.key);return R({ok:true});
    }
    if(act==='moderateParticipant'){
      const x=await access(c,a,String(b.callId||''));requirePresenter(x,a);const target=String(b.targetKey||'');if(!target||target===a.key)throw new Error('Elegí otro integrante.');const p=await participant(c,x.id,target);if(!p||!p.joined_at||p.left_at||p.removed_at)throw new Error('El integrante ya no está en la llamada.');const patch:any={last_seen_at:p.last_seen_at};
      if(Object.prototype.hasOwnProperty.call(b,'micAllowed')){patch.mic_allowed=!!b.micAllowed;if(!patch.mic_allowed)patch.mic_enabled=false;}
      if(Object.prototype.hasOwnProperty.call(b,'cameraAllowed')){patch.camera_allowed=!!b.cameraAllowed;if(!patch.camera_allowed)patch.camera_enabled=false;}
      await c.from('hc_call_participants').update(patch).eq('call_id',x.id).eq('participant_key',target);return R({ok:true});
    }
    if(act==='transferPresenter'){
      const x=await access(c,a,String(b.callId||''));requirePresenter(x,a);const target=String(b.targetKey||''),p=await participant(c,x.id,target);if(!p||!p.joined_at||p.left_at||p.removed_at)throw new Error('Integrante no encontrado o desconectado.');await c.from('hc_calls').update({presenter_key:target,updated_at:new Date().toISOString()}).eq('id',x.id);return R({ok:true,presenterKey:target});
    }
    if(act==='removeParticipant'){
      const x=await access(c,a,String(b.callId||''));requirePresenter(x,a);const target=String(b.targetKey||'');if(!target||target===a.key)throw new Error('El presentador no puede retirarse a sí mismo desde este control.');const p=await participant(c,x.id,target);if(!p||p.left_at||p.removed_at)throw new Error('El integrante ya no está en la llamada.');const now=new Date().toISOString();await clearPeerSignals(c,x.id,target);await c.from('hc_call_participants').update({left_at:now,last_seen_at:now,removed_at:now,removed_by_key:a.key,mic_enabled:false,camera_enabled:false,screen_sharing:false}).eq('call_id',x.id).eq('participant_key',target);return R({ok:true});
    }
    if(act==='leaveCall'){
      let x=await call(c,String(b.callId||''),i),now=new Date().toISOString();await clearPeerSignals(c,x.id,a.key);await c.from('hc_call_participants').update({left_at:now,last_seen_at:now,screen_sharing:false}).eq('call_id',x.id).eq('participant_key',a.key);
      const {data:alive}=await c.from('hc_call_participants').select('participant_key').eq('call_id',x.id).not('joined_at','is',null).is('left_at',null).is('removed_at',null).gte('last_seen_at',new Date(Date.now()-45000).toISOString()).order('invited_at');
      if(!(alive||[]).length){await c.from('hc_calls').update({status:'ended',ended_at:now,updated_at:now}).eq('id',x.id);await c.from('hc_call_signals').delete().eq('call_id',x.id);}else if(String(x.presenter_key)===a.key){await c.from('hc_calls').update({presenter_key:alive![0].participant_key,updated_at:now}).eq('id',x.id);}return R({ok:true});
    }
    if(act==='endCall'){
      const x=await access(c,a,String(b.callId||''));requirePresenter(x,a);const now=new Date().toISOString();await c.from('hc_calls').update({status:'ended',ended_at:now,updated_at:now}).eq('id',x.id);await c.from('hc_call_participants').update({left_at:now,last_seen_at:now,screen_sharing:false}).eq('call_id',x.id).is('left_at',null);await c.from('hc_call_signals').delete().eq('call_id',x.id);return R({ok:true});
    }
    return R({ok:false,error:'Acción no reconocida.'},400);
  }catch(e){const m=String((e as any)?.message||e);return R({ok:false,error:m},/Sesión|acceso|institución vinculada|participa|presentador actual|retiró/i.test(m)?401:400)}
});
