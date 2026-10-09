import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type, apikey',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store'
};
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:CORS});
function requirePublishable(req:Request){
  const given=String(req.headers.get('apikey')||''); let keys:any={};
  try{keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}')}catch{}
  if(!given || !Object.values(keys).map(String).includes(given)) throw new Error('Aplicación no autorizada.');
}
function db(){
  let keys:any={}; try{keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')}catch{}
  const secret=String(keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
  return createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
const hex=(a:Uint8Array)=>Array.from(a).map(x=>x.toString(16).padStart(2,'0')).join('');
const unhex=(s:string)=>new Uint8Array((s.match(/../g)||[]).map(x=>parseInt(x,16)));
async function sha256(s:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))))}
function randomHex(n=32){const a=new Uint8Array(n);crypto.getRandomValues(a);return hex(a)}
async function derive(password:string,salt:string,iterations=210000){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(salt),iterations},key,256);
  return hex(new Uint8Array(bits));
}
function same(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function newPassword(password:string){const salt=randomHex(16),iterations=210000;return{salt,hash:await derive(password,salt,iterations),iterations}}
async function findInstitution(c:any,name:string){
  let r=await c.from('hc_auth_institutions').select('*').eq('id',name).maybeSingle(); if(r.error)throw r.error; if(r.data)return r.data;
  r=await c.from('hc_auth_institutions').select('*').ilike('name',name).limit(1).maybeSingle(); if(r.error)throw r.error; if(r.data)return r.data;
  r=await c.from('hc_auth_institutions').select('*').ilike('display_name',name).limit(1).maybeSingle(); if(r.error)throw r.error; return r.data||null;
}
async function createSeedSession(c:any,institutionId:string){
  const token=randomHex(),token_hash=await sha256(token),now=new Date(),expires=new Date(now.getTime()+24*3600000);
  await c.from('hc_seed_sessions').delete().lt('expires_at',now.toISOString());
  const {error}=await c.from('hc_seed_sessions').insert({token_hash,institution_id:institutionId,expires_at:expires.toISOString(),last_seen_at:now.toISOString()});
  if(error)throw error;
  return{token,expiresAt:expires.toISOString()};
}

async function rememberDevice(c:any,institutionId:string){
  const token=randomHex(),token_hash=await sha256(token);
  const {error}=await c.from('hc_seed_devices').insert({token_hash,institution_id:institutionId});
  if(error)throw error;
  return token;
}
function institutionReply(institution:any,s:any,deviceToken?:string){
  const dataId=String(institution.data_institution_id||institution.id);
  return {ok:true,seedAdminToken:s.token,expiresAt:s.expiresAt,deviceToken,
    user:{username:'admin',name:'Admin semilla local',role:'admin',localSeed:true},
    institution:{id:String(institution.id),name:String(institution.name),displayName:String(institution.display_name||''),role:'admin',dataInstitutionId:dataId},
    backend:{id:dataId,authInstitutionId:String(institution.id),name:String(institution.name),dataInstitutionId:dataId}};
}
async function deviceAction(c:any,b:any,action:string){
  if(action==='rememberDevice'){
    const h=await sha256(String(b.seedAdminToken||''));
    const {data:s,error}=await c.from('hc_seed_sessions').select('institution_id,expires_at').eq('token_hash',h).maybeSingle();
    if(error)throw error;
    if(!s||Date.parse(s.expires_at)<=Date.now())throw Error('Sesión de vinculación inválida o vencida.');
    const {data:i,error:ie}=await c.from('hc_auth_institutions').select('*').eq('id',s.institution_id).maybeSingle();
    if(ie)throw ie;if(!i?.active)throw Error('La institución no está habilitada.');
    return {ok:true,deviceToken:await rememberDevice(c,String(i.id)),institutionId:String(i.id)};
  }
  const token=String(b.deviceToken||'');
  if(!/^[a-f0-9]{64}$/.test(token))throw Error('Vinculación del equipo inválida.');
  const h=await sha256(token);
  const {data:d,error}=await c.from('hc_seed_devices').select('institution_id,revoked_at,last_seen_at').eq('token_hash',h).maybeSingle();
  if(error)throw error;if(!d||d.revoked_at)throw Error('Vinculación del equipo inválida o revocada.');
  if(action==='revokeDevice'){
    const {error:e}=await c.from('hc_seed_devices').update({revoked_at:new Date().toISOString()}).eq('token_hash',h);
    if(e)throw e;return {ok:true};
  }
  const {data:i,error:ie}=await c.from('hc_auth_institutions').select('*').eq('id',d.institution_id).maybeSingle();
  if(ie)throw ie;if(!i?.active)throw Error('La institución no está habilitada.');
  const s=await createSeedSession(c,String(i.id));
  if(Date.parse(d.last_seen_at)<Date.now()-60000)await c.from('hc_seed_devices').update({last_seen_at:new Date().toISOString()}).eq('token_hash',h);
  return institutionReply(i,s);
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return reply({ok:false,error:'Método no permitido.'},405);
  try{
    requirePublishable(req);
    const raw=await req.text(); if(raw.length>120000)return reply({ok:false,error:'Solicitud demasiado grande.'},413);
    const b=JSON.parse(raw||'{}'),action=String(b.action||'resolveBackend');
    if(['rememberDevice','restoreDevice','revokeDevice'].includes(action))return reply(await deviceAction(db(),b,action));
    if(action!=='resolveBackend'&&action!=='resolveInstitution')return reply({ok:false,error:'Acción no reconocida.'},400);
    const name=String(b.name||b.nombre||'').trim(),password=String(b.password||'');
    if(!name||!password)throw new Error('Completá nombre de institución y contraseña.');
    const c=db();
    let institution=await findInstitution(c,name);
    if(!institution)throw new Error('La institución no está registrada en Supabase. Creala o migrala desde la cuenta Hospitalito.');
    if(institution.active===false)throw new Error('La institución no está habilitada.');
    let migratedPassword=false;
    if(!String(institution.setup_password_hash||'')){
      throw Error('La institución necesita configurar su contraseña en Supabase desde la cuenta Hospitalito.');
    }else{
      const h=await derive(password,String(institution.setup_password_salt||''),Number(institution.setup_password_iterations||210000));
      if(!same(h,String(institution.setup_password_hash)))throw new Error('Institución o contraseña incorrectas.');
    }
    const s=await createSeedSession(c,String(institution.id));
    const dataId=String(institution.data_institution_id||institution.id);
    return reply({
      ok:true,
      migratedPassword,
      deviceToken:await rememberDevice(c,String(institution.id)),
      seedAdminToken:s.token,
      expiresAt:s.expiresAt,
      user:{username:'admin',name:'Admin semilla local',role:'admin',localSeed:true},
      institutions:[{id:String(institution.id),name:String(institution.name),displayName:String(institution.display_name||''),description:String(institution.description||''),role:'admin',dataInstitutionId:dataId,logoData:String(institution.logo_data||'')}],
      institution:{id:String(institution.id),name:String(institution.name),displayName:String(institution.display_name||''),description:String(institution.description||''),role:'admin',dataInstitutionId:dataId,logoData:String(institution.logo_data||'')},
      backend:{id:dataId,authInstitutionId:String(institution.id),name:String(institution.name),dataInstitutionId:dataId}
    });
  }catch(e){return reply({ok:false,error:String((e as any)?.message||e)},400)}
});
