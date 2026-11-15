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
  const given=String(req.headers.get('apikey')||'');let keys:any={};
  try{keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}')}catch{}
  if(!given||!Object.values(keys).map(String).includes(given))throw new Error('Aplicación no autorizada.');
}
function db(){
  let keys:any={};try{keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')}catch{}
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
function cleanProfile(p:any={}){return{
  phone:String(p.phone||''),specialty:String(p.specialty||''),licenseNumber:String(p.licenseNumber||''),professionalTitle:String(p.professionalTitle||''),photo:String(p.photo||''),signature:String(p.signature||''),signatureUpdatedAt:String(p.signatureUpdatedAt||''),uiTheme:String(p.uiTheme||''),preferences:p.preferences&&typeof p.preferences==='object'?p.preferences:{}
}}
function publicUser(u:any,role?:string){return{username:String(u?.username||''),name:String(u?.name||u?.username||''),role:String(role||u?.default_role||'medico'),email:String(u?.email||''),...cleanProfile(u?.profile||{}),active:u?.active!==false,isGlobalAdmin:!!u?.is_global_admin,mustChangePassword:!!u?.must_change_password,createdAt:u?.created_at||'',updatedAt:u?.updated_at||''}}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
  if(req.method!=='POST')return reply({ok:false,error:'Método no permitido.'},405);
  const started=performance.now();
  try{
    requirePublishable(req);
    const raw=await req.text();if(raw.length>64000)return reply({ok:false,error:'Solicitud demasiado grande.'},413);
    const b=JSON.parse(raw||'{}');
    if(String(b.action||'')!=='authenticateUser')return reply({ok:false,error:'Acción no permitida en este endpoint.'},400);
    const q=String(b.username||'').trim(),password=String(b.password||'');
    if(!q||!password)throw new Error('Completá usuario y contraseña.');
    if(q.toLowerCase()==='admin')throw new Error('El admin semilla es una herramienta local. Ingresá con admin/admin y vinculá este equipo a una institución.');
    const c=db();
    const t0=performance.now();
    const {data:user,error}=await c.from('hc_auth_users').select('*').ilike('username',q).limit(1).maybeSingle();
    if(error)throw error;if(!user||user.active===false)throw new Error('Usuario o contraseña incorrectos.');
    if(!user.password_hash||!user.password_salt)throw new Error('La cuenta todavía no tiene credenciales Supabase migradas.');
    const t1=performance.now();
    const got=await derive(password,String(user.password_salt),Number(user.password_iterations||210000));
    if(!same(got,String(user.password_hash)))throw new Error('Usuario o contraseña incorrectos.');
    const t2=performance.now();
    const token=randomHex(),token_hash=await sha256(token),now=new Date(),expires=new Date(now.getTime()+24*3600000);
    const membershipPromise=user.is_global_admin
      ? c.from('hc_auth_institutions').select('*').eq('active',true).order('name')
      : c.from('hc_auth_memberships').select('role,institution_id,hc_auth_institutions(*)').eq('username',user.username).eq('active',true);
    const sessionPromise=c.from('hc_auth_sessions').insert({token_hash,username:user.username,expires_at:expires.toISOString(),last_seen_at:now.toISOString()});
    const [membershipsResult,sessionResult]=await Promise.all([membershipPromise,sessionPromise]);
    if(sessionResult.error)throw sessionResult.error;if(membershipsResult.error)throw membershipsResult.error;
    c.from('hc_auth_sessions').delete().lt('expires_at',now.toISOString()).then(()=>{}).catch(()=>{});
    let institutions:any[]=[];
    if(user.is_global_admin){
      institutions=(membershipsResult.data||[]).filter((i:any)=>i.active!==false).map((i:any)=>({id:String(i.id),name:String(i.name||i.display_name||i.id),displayName:String(i.display_name||''),description:String(i.description||''),role:'superadmin',dataInstitutionId:String(i.data_institution_id||i.id),active:true,logoData:String(i.logo_data||'')}));
    }else{
      institutions=(membershipsResult.data||[]).filter((x:any)=>x.hc_auth_institutions?.active!==false).map((x:any)=>({id:String(x.institution_id),name:String(x.hc_auth_institutions?.name||x.institution_id),displayName:String(x.hc_auth_institutions?.display_name||''),description:String(x.hc_auth_institutions?.description||''),role:String(x.role||user.default_role||'medico'),dataInstitutionId:String(x.hc_auth_institutions?.data_institution_id||x.institution_id),active:true,logoData:String(x.hc_auth_institutions?.logo_data||'')}));
      if(user.default_role!=='cliente'&&!institutions.length)throw new Error('La cuenta no tiene instituciones habilitadas.');
    }
    const t3=performance.now();
    return reply({ok:true,token,expiresAt:expires.toISOString(),user:publicUser(user),institutions,migrated:false,loginPath:'fast-v1',timingMs:{lookup:Math.round(t1-t0),password:Math.round(t2-t1),sessionAndMemberships:Math.round(t3-t2),total:Math.round(performance.now()-started)}});
  }catch(e){return reply({ok:false,error:String((e as any)?.message||e),loginPath:'fast-v1',elapsedMs:Math.round(performance.now()-started)},400)}
});
