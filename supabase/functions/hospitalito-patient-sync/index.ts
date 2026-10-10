import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const TABLE='hc_state', SESSION_TABLE='hc_sync_sessions';
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});

function requirePublishable(req:Request){
  const given=String(req.headers.get('apikey')||'');
  let keys:any={};
  try{keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');}catch(_){keys={};}
  const valid=Object.values(keys).map(String).filter(Boolean);
  if(!given||!valid.includes(given))throw new Error('Aplicación no autorizada.');
}
async function sha256(text:string){
  const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function db(){
  let secrets:any={};
  try{secrets=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');}catch(_){secrets={};}
  const secret=String(secrets.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
  return createClient(Deno.env.get('SUPABASE_URL')!,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function requireSync(c:any,token:string,institutionId:string){
  if(!token||!institutionId)throw new Error('Falta sesión de sincronización.');
  const h=await sha256(token);
  const {data,error}=await c.from(SESSION_TABLE).select('institution_id,expires_at').eq('token_hash',h).maybeSingle();
  if(error)throw error;
  if(!data||String(data.institution_id)!==institutionId||Date.parse(data.expires_at)<=Date.now()){
    throw new Error('Sesión de sincronización inválida o vencida.');
  }
}
const selectCols='institution_id,bucket,record_id,payload,sort_index,deleted,updated_at,revision,sync_seq,writer';

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  try{
    requirePublishable(req);
    const b=await req.json();
    const institutionId=String(b.institutionId||'').trim();
    const syncToken=String(b.syncToken||'').trim();
    const patientId=String(b.patientId||'').trim();
    if(!institutionId||!patientId)throw new Error('Falta institución o paciente.');
    const c=db();
    await requireSync(c,syncToken,institutionId);

    const fields=(Array.isArray(b.fields)?b.fields:[])
      .map((x:any)=>String(x||'').trim())
      .filter((x:string)=>x && x.length<=100)
      .slice(0,80);
    const prefix=encodeURIComponent(patientId)+'::';
    let q=c.from(TABLE).select(selectCols)
      .eq('institution_id',institutionId)
      .eq('bucket','clinical');
    if(fields.length){
      const ids=fields.map((f:string)=>prefix+encodeURIComponent(f));
      q=q.in('record_id',ids);
    }else{
      q=q.like('record_id',prefix+'%');
    }
    const {data,error}=await q.order('sort_index',{ascending:true}).limit(200);
    if(error)throw error;
    return reply({ok:true,rows:data||[],patientId,syncVersion:2,targeted:true});
  }catch(e){
    return reply({ok:false,error:String((e as any)?.message||e)},400);
  }
});
