import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, apikey','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const R=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:CORS});
function db(){const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');return createClient(Deno.env.get('SUPABASE_URL')!,String(keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''),{auth:{persistSession:false,autoRefreshToken:false}})}
async function sha(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function actor(c:any,token:string,i:string){
 if(!token||!i)throw Error('Ingresá nuevamente y seleccioná la institución.');
 const h=await sha(token),[ss,us,ir]=await Promise.all([c.from('hc_seed_sessions').select('institution_id,expires_at').eq('token_hash',h).maybeSingle(),c.from('hc_auth_sessions').select('username,expires_at').eq('token_hash',h).maybeSingle(),c.from('hc_auth_institutions').select('active,data_institution_id').eq('id',i).maybeSingle()]);
 if(!ir.data?.active)throw Error('Institución no habilitada.');
 if(ss.data&&Date.parse(ss.data.expires_at)>Date.now()&&String(ss.data.institution_id)===i)return{username:'admin',role:'admin',dataId:ir.data.data_institution_id||i};
 if(!us.data||Date.parse(us.data.expires_at)<=Date.now())throw Error('Sesión vencida.');
 const [u,m]=await Promise.all([c.from('hc_auth_users').select('active,is_global_admin').eq('username',us.data.username).maybeSingle(),c.from('hc_auth_memberships').select('active,role').eq('username',us.data.username).eq('institution_id',i).maybeSingle()]);
 if(!u.data?.active||u.data.is_global_admin||!m.data?.active)throw Error('No tenés acceso a esta institución.');
 return{username:us.data.username,role:m.data.role,dataId:ir.data.data_institution_id||i};
}
const MIME:any={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword'};
function permit(role:string,kind:string){return kind==='donor'||kind==='blood_unit'?role==='hemoterapia'||role==='admin':role==='medico'||role==='admin'}
function text(x:any,max=500){return String(x??'').trim().slice(0,max)}
function clean(kind:string,p:any){
 const fields=kind==='donor'?['name','document','dob','contact','address','group','rh','donationCode','donationAt','evaluation','evaluatedBy','consentRef','notes','patientId','justification']:['code','component','group','rh','phenotype','lot','origin','donorId','collectedAt','expiresAt','volume','location','status','patientId','compatibility','responsible','transfusedAt','notes'];
 const out:any={};for(const k of fields)out[k]=text(p[k],k==='notes'?2000:500);
 if(kind==='donor'){if(!out.name||!out.document)throw Error('Completá nombre y documento.');if(out.patientId&&!out.justification)throw Error('La vinculación a un paciente requiere justificación terapéutica.');}
 if(kind==='blood_unit'){
  if(!out.code||!out.component||!out.expiresAt||!out.origin)throw Error('Completá código único, componente, origen y vencimiento.');
  if(!['Cuarentena','Disponible','Reservada','Entregada','Transfundida','Devuelta','Descartada'].includes(out.status))throw Error('Estado de unidad inválido.');
  if(['Reservada','Entregada','Transfundida'].includes(out.status)&&!out.patientId)throw Error('Seleccioná el paciente receptor.');
  if(['Disponible','Reservada','Entregada','Transfundida'].includes(out.status)&&(!out.responsible||!out.compatibility))throw Error('Registrá validación / compatibilidad y responsable de Hemoterapia.');
  if(!Number.isFinite(Date.parse(out.expiresAt)))throw Error('Vencimiento inválido.');
  if(['Disponible','Reservada','Entregada'].includes(out.status)&&Date.parse(out.expiresAt)<Date.now())throw Error('La unidad está vencida: revisá su estado.');
  if(out.status==='Transfundida'&&(!Number.isFinite(Date.parse(out.transfusedAt))||Date.parse(out.transfusedAt)>Date.parse(out.expiresAt)))throw Error('Registrá una fecha de transfusión válida y anterior al vencimiento.');
 }
 return out;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});
 try{
  const keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');if(!Object.values(keys).includes(req.headers.get('apikey')))throw Error('Aplicación no autorizada.');
  const b=await req.json(),c=db(),i=text(b.institutionId),a=await actor(c,text(b.token,500),i),act=text(b.action),kind=text(b.kind);
  if(act==='saveInstitutionBrand'){
   if(a.role!=='admin')throw Error('Sólo Administración puede cambiar el membrete.');const logo=text(b.logoData,500000);
   if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(logo))throw Error('Logo inválido. Usá PNG, JPG o WebP.');
   const ir=await c.from('hc_auth_institutions').update({logo_data:logo,updated_at:new Date().toISOString()}).eq('id',i);if(ir.error)throw ir.error;
   for(let n=0;n<6;n++){
    const old=await c.from('hc_state').select('payload,revision').eq('institution_id',a.dataId).eq('bucket','inst').eq('record_id','main').maybeSingle();if(old.error)throw old.error;
    const branding:any={logoData:logo,updatedAt:new Date().toISOString(),updatedBy:a.username};
    if(b.programLogo){const pl=text(b.programLogo,300000);if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(pl))throw Error('Logo de Hospitalito inválido.');branding.programLogo=pl;}
    const row={payload:{...(old.data?.payload||{}),value:{...(old.data?.payload?.value||{}),...branding}},deleted:false,writer:a.username};
    const u=old.data?await c.from('hc_state').update(row).eq('institution_id',a.dataId).eq('bucket','inst').eq('record_id','main').eq('revision',old.data.revision).select('revision'):await c.from('hc_state').insert({institution_id:a.dataId,bucket:'inst',record_id:'main',sort_index:0,...row}).select('revision');
    if(u.error&&u.error.code!=='23505')throw u.error;if(u.data?.length)return R({ok:true,branding});
   }throw Error('Hubo otro cambio de membrete. Reintentá.');
  }
  if(!['donor','blood_unit','consent_template','consent_patient'].includes(kind))throw Error('Registro inválido.');
  if(act==='list'){
   if(kind==='donor'&&!['hemoterapia','admin'].includes(a.role))throw Error('Los datos personales de donantes son exclusivos de Hemoterapia.');
   let q=c.from('hc_service_records').select('*').eq('institution_id',i).eq('kind',kind).order('updated_at',{ascending:false}).limit(1000);if(kind==='consent_patient')q=q.eq('patient_id',text(b.patientId));
   const r=await q;if(r.error)throw r.error;return R({ok:true,records:r.data||[]});
  }
  if(act==='save'){
   if(!permit(a.role,kind)||kind.startsWith('consent'))throw Error('Tu rol dispone de lectura en este registro.');
   const payload=clean(kind,b.payload||{}),id=b.id?text(b.id):crypto.randomUUID();
   if(kind==='blood_unit'&&payload.donorId){const dr=await c.from('hc_service_records').select('id').eq('institution_id',i).eq('kind','donor').eq('id',payload.donorId).maybeSingle();if(!dr.data)throw Error('Donante no encontrado en la institución.');}
   const row={payload,patient_id:payload.patientId||null,updated_by:a.username};
   const r=b.id?await c.from('hc_service_records').update(row).eq('institution_id',i).eq('kind',kind).eq('id',id).eq('revision',Number(b.revision)).select('*'):await c.from('hc_service_records').insert({institution_id:i,kind,id,...row}).select('*');
   if(r.error)throw Error(r.error.code==='23505'?'Ya existe una unidad con ese código.':r.error.message);if(!r.data?.length)return R({ok:false,error:'Otro usuario modificó el registro. Actualizá antes de guardar.'},409);return R({ok:true,record:r.data[0]});
  }
  if(act==='audit'){
   if(!['hemoterapia','admin'].includes(a.role))throw Error('Sólo Hemoterapia puede consultar esta trazabilidad.');const r=await c.from('hc_service_audit').select('actor,at,before_payload,after_payload').eq('institution_id',i).eq('kind',kind).eq('record_id',text(b.id)).order('id');if(r.error)throw r.error;return R({ok:true,movements:r.data||[]});
  }
  if(act==='uploadConsent'){
   if(!permit(a.role,kind)||!kind.startsWith('consent'))throw Error('Sólo el médico o Administración puede cargar consentimientos.');
   const filename=text(b.filename,200),ext=filename.split('.').pop()?.toLowerCase()||'',mime=MIME[ext];if(!mime||Number(b.size)>10485760||Number(b.size)<=0)throw Error('Archivo no admitido o mayor a 10 MB.');
   const id=crypto.randomUUID(),path=`${i}/${kind}/${id}.${ext}`,r=await c.storage.from('hc-consents').createSignedUploadUrl(path);if(r.error)throw r.error;
   return R({ok:true,id,path,mime,uploadUrl:r.data.signedUrl});
  }
  if(act==='finishConsent'){
   if(!permit(a.role,kind)||!kind.startsWith('consent'))throw Error('Carga no autorizada.');const path=text(b.path),id=text(b.id);
   if(!new RegExp('^'+i.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/'+kind+'/'+id+'\\.(pdf|png|jpg|jpeg|txt|docx|doc)$').test(path)||! /^[0-9a-f-]{36}$/.test(id))throw Error('Ruta de archivo inválida.');
   const ext=path.split('.').pop()!,folder=path.slice(0,path.lastIndexOf('/')),filename=path.slice(path.lastIndexOf('/')+1),info=await c.storage.from('hc-consents').list(folder,{search:filename,limit:5});if(info.error)throw info.error;const file=info.data.find((x:any)=>x.name===filename);if(!file)throw Error('El archivo todavía no terminó de subirse.');
   const payload={title:text(b.title,200)||text(b.filename,200),filename:text(b.filename,200),path,mime:MIME[ext],size:Number(file.metadata?.size||0),signedPaper:!!b.signedPaper};
   if(kind==='consent_patient'&&!text(b.patientId))throw Error('Seleccioná el paciente.');
   const r=await c.from('hc_service_records').insert({institution_id:i,kind,id,patient_id:kind==='consent_patient'?text(b.patientId):null,payload,updated_by:a.username}).select('*');if(r.error)throw r.error;return R({ok:true,record:r.data[0]});
  }
  if(act==='openConsent'){
   if(!kind.startsWith('consent'))throw Error('Documento inválido.');const r=await c.from('hc_service_records').select('payload,patient_id').eq('institution_id',i).eq('kind',kind).eq('id',text(b.id)).maybeSingle();if(r.error)throw r.error;if(!r.data)throw Error('Documento no encontrado.');
   const u=await c.storage.from('hc-consents').createSignedUrl(r.data.payload.path,300);if(u.error)throw u.error;return R({ok:true,url:u.data.signedUrl,payload:r.data.payload});
  }
  return R({ok:false,error:'Acción no reconocida.'},400);
 }catch(e){return R({ok:false,error:String((e as any)?.message||e)},400)}
});

