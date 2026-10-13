import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, apikey','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:CORS});
const str=(v:any,n=500)=>String(v??'').trim().slice(0,n);
const check=(r:any)=>{if(r.error)throw Error(r.error.message);return r.data};
function db(){const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');return createClient(Deno.env.get('SUPABASE_URL')!,String(keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''),{auth:{persistSession:false,autoRefreshToken:false}})}
async function sha(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
function integer(v:any,min:number,max:number){const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Número fuera de rango.');return n}
const cents=(v:any)=>integer(v,0,100000000000);
const validDate=(v:any)=>{const d=new Date(v);if(!Number.isFinite(+d))throw Error('Fecha inválida.');return d.toISOString()};
function merchant(id:string){const m=JSON.parse(Deno.env.get('HC_MP_ACCOUNTS')||'{}');const a=m[id];return a?.accessToken&&a?.webhookSecret&&a?.collectorId?a:null}
async function actor(c:any,b:any){
 const h=await sha(str(b.token,1000)),i=str(b.institutionId);
 const [auth,seed]=await Promise.all([c.from('hc_auth_sessions').select('username,expires_at').eq('token_hash',h).maybeSingle(),c.from('hc_seed_sessions').select('institution_id,expires_at').eq('token_hash',h).maybeSingle()]);check(auth);check(seed);
 if(seed.data&&Date.parse(seed.data.expires_at)>Date.now()&&String(seed.data.institution_id)===i){if(!check(await c.from('hc_auth_institutions').select('id').eq('id',i).eq('active',true).maybeSingle()))throw Error('Institución no habilitada.');return {username:'admin',role:'admin',global:false,institutionId:i,seed:true};}
 if(!auth.data||Date.parse(auth.data.expires_at)<=Date.now())throw Error('Ingresá nuevamente. La sesión venció.');
 const u=check(await c.from('hc_auth_users').select('username,active,is_global_admin').eq('username',auth.data.username).maybeSingle());if(!u?.active)throw Error('Cuenta no habilitada.');
 if(u.is_global_admin)return {username:u.username,role:'superadmin',global:true,institutionId:i};
 const [m,inst]=await Promise.all([c.from('hc_auth_memberships').select('role,active').eq('username',u.username).eq('institution_id',i).maybeSingle(),c.from('hc_auth_institutions').select('active').eq('id',i).maybeSingle()]);check(m);check(inst);
 if(!m.data?.active||!inst.data?.active)throw Error('No tenés acceso a esta institución.');return {username:u.username,role:m.data.role,global:false,institutionId:i};
}
const platform=(a:any)=>{if(!a.global)throw Error('Esta acción corresponde a la cuenta Hospitalito.');};
const manager=(a:any)=>a.global||['admin','contabilidad','administrativo'].includes(a.role);
function institution(a:any,i:any){if(!a.global&&str(i)!==a.institutionId)throw Error('No tenés acceso a esta institución.');return str(i)||a.institutionId}
async function rows(q:any){let all:any[]=[];for(let n=0;n<50;n++){const r=check(await q.range(n*1000,n*1000+999))||[];all=all.concat(r);if(r.length<1000)return all}throw Error('Demasiados registros. Reducí el período.');}
function monthly(start:string,n:number){const d=new Date(start),day=d.getUTCDate(),y=d.getUTCFullYear(),m=d.getUTCMonth()+n;d.setUTCDate(1);d.setUTCFullYear(y,m,1);const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,end));return d.toISOString()}
async function generate(c:any,contracts:any[],settings:any){if(!settings.collectionEnabled)return;const out=[];for(const contract of contracts){const p=contract.payload;if(!p.enabled||!p.amountCents)continue;for(let n=0;n<240;n++){const due=monthly(p.trialEnd,n);if(Date.parse(due)>Date.now())break;out.push({contract_id:contract.id,institution_id:contract.institution_id,username:contract.username,account_id:contract.account_id,period:String(n),title:p.title||'Licencia Hospitalito',amount_cents:p.amountCents,due_at:due});}}if(out.length)check(await c.from('hc_billing_invoices').upsert(out,{onConflict:'contract_id,period',ignoreDuplicates:true}));}
async function settings(c:any){return check(await c.from('hc_billing_settings').select('payload').eq('key','main').single()).payload}
async function contractScope(c:any,a:any){let q=c.from('hc_billing_contracts').select('*').order('id');if(!a.global){q=q.eq('institution_id',a.institutionId);if(!manager(a))q=q.or(`username.is.null,username.eq.${a.username}`)}return rows(q)}
async function invoice(c:any,a:any,id:any){const v=check(await c.from('hc_billing_invoices').select('*').eq('id',str(id)).maybeSingle());if(!v)throw Error('Liquidación no encontrada.');institution(a,v.institution_id);if(!manager(a)&&v.username&&v.username!==a.username)throw Error('La liquidación pertenece a otro usuario.');return v}
async function mpFetch(path:string,m:any,method='GET',body?:any){const r=await fetch('https://api.mercadopago.com'+path,{method,headers:{Authorization:'Bearer '+m.accessToken,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const j=await r.json();if(!r.ok)throw Error('El proveedor no pudo procesar la solicitud. Intentá nuevamente.');return j}
async function settleMP(c:any,accountId:string,paymentId:string,a?:any,expectedInvoice?:string){
 if(!/^\d+$/.test(paymentId))throw Error('Identificador de pago inválido.');const m=merchant(accountId);if(!m)throw Error('Cuenta de cobro sin configurar en el servidor.');const p=await mpFetch('/v1/payments/'+paymentId,m);
 const ref=str(p.external_reference),checkout=check(await c.from('hc_billing_checkouts').select('*').eq('id',ref).maybeSingle());
 if(!checkout||checkout.account_id!==accountId||String(p.collector_id)!==String(m.collectorId)||p.currency_id!=='ARS'||Math.round(Number(p.transaction_amount)*100)!==Number(checkout.amount_cents)||String(p.id)!==paymentId)throw Error('El pago no coincide con esta cuenta y liquidación.');
 if(expectedInvoice&&checkout.invoice_id!==expectedInvoice)throw Error('El pago corresponde a otra liquidación.');if(a)await invoice(c,a,checkout.invoice_id);
 const refunded=Math.round(Number(p.transaction_amount_refunded||0)*100);if(!Number.isSafeInteger(refunded)||refunded<0||refunded>checkout.amount_cents)throw Error('Reintegro inconsistente.');
 return check(await c.rpc('hc284_apply_payment',{p_invoice:checkout.invoice_id,p_account:accountId,p_provider:'mercadopago',p_payment_id:paymentId,p_amount:checkout.amount_cents-refunded,p_status:p.status==='approved'?'approved':str(p.status),p_reference:str(p.status_detail),p_actor:a?.username||'mercadopago'}));
}
async function webhook(req:Request,c:any,url:URL){
 const id=str(url.searchParams.get('data.id')),accountId=str(url.searchParams.get('account')),m=merchant(accountId),header=req.headers.get('x-signature')||'',parts=Object.fromEntries(header.split(',').map(x=>x.trim().split('='))),rid=req.headers.get('x-request-id');
 if(!m||!id||!rid||!/^\d+$/.test(parts.ts||'')||!/^[0-9a-f]{64}$/i.test(parts.v1||''))throw Error('Notificación no autorizada.');
 // Retries can arrive late: signed events are idempotent and the current payment is re-read from the provider.
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(m.webhookSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`id:${id.toLowerCase()};request-id:${rid};ts:${parts.ts};`)));const got=Uint8Array.from(parts.v1.match(/../g)!,x=>parseInt(x,16));let diff=0;for(let n=0;n<32;n++)diff|=signature[n]^got[n];if(diff)throw Error('Firma de notificación inválida.');
 const body=await req.json();if(body.type!=='payment')return reply({ok:true,ignored:true});if(String(body.data?.id)!==id)throw Error('Notificación inconsistente.');await settleMP(c,accountId,id);return reply({ok:true});
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:CORS});if(req.method!=='POST')return reply({ok:false,error:'Método no permitido.'},405);
 try{
  const c=db(),url=new URL(req.url);if(url.searchParams.get('webhook')==='1')return await webhook(req,c,url);
  const keys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');if(!Object.values(keys).includes(req.headers.get('apikey')))throw Error('Aplicación no autorizada.');
  const raw=await req.text();if(raw.length>500000)throw Error('Solicitud demasiado grande.');const b=JSON.parse(raw),a=await actor(c,b),act=str(b.action);
  if(act==='status'){
   const config=await settings(c),contracts=await contractScope(c,a);await generate(c,contracts,config);if(a.global)return reply({ok:true,accessMode:'rw',contracts:[],pending:0,messages:[]});
   const dataId=check(await c.from('hc_auth_institutions').select('data_institution_id').eq('id',a.institutionId).single()).data_institution_id||a.institutionId;
   let pending=c.from('hc_billing_invoices').select('id,due_at,amount_cents,paid_cents').eq('institution_id',a.institutionId).eq('status','pending').order('due_at').limit(100),messages=c.from('hc_billing_messages').select('body,created_at').eq('institution_id',a.institutionId).order('created_at',{ascending:false}).limit(5);
   if(!manager(a)){pending=pending.or(`username.is.null,username.eq.${a.username}`);messages=messages.or(`username.is.null,username.eq.${a.username}`)}
   const [mode,vs,ms]=await Promise.all([c.rpc('hc284_access_mode',{p_data_id:dataId,p_username:a.username}),pending,messages]);return reply({ok:true,accessMode:check(mode),contracts,pending:check(vs).length,messages:check(ms),collectionEnabled:config.collectionEnabled});
  }
  if(act==='overview'){
   const config=await settings(c),contracts=await contractScope(c,a);await generate(c,contracts,config);
   let invoices=c.from('hc_billing_invoices').select('*').order('due_at',{ascending:false}),messages=c.from('hc_billing_messages').select('*').order('created_at',{ascending:false});
   if(!a.global){invoices=invoices.eq('institution_id',a.institutionId);messages=messages.eq('institution_id',a.institutionId);if(!manager(a)){invoices=invoices.or(`username.is.null,username.eq.${a.username}`);messages=messages.or(`username.is.null,username.eq.${a.username}`)}}
   const accounts=await rows(c.from('hc_billing_accounts').select('*').order('id'));
   const [vs,ms]=await Promise.all([rows(invoices),rows(messages)]);
   let institutions:any[]=[],users:any[]=[],memberships:any[]=[];if(a.global)[institutions,users,memberships]=await Promise.all([rows(c.from('hc_auth_institutions').select('id,name,display_name,active').order('id')),rows(c.from('hc_auth_users').select('username,profile,active').order('username')),rows(c.from('hc_auth_memberships').select('institution_id,username,role,active').order('username'))]);
   const access=a.global?'rw':check(await c.rpc('hc284_access_mode',{p_data_id:check(await c.from('hc_auth_institutions').select('data_institution_id').eq('id',a.institutionId).single()).data_institution_id||a.institutionId,p_username:a.username}));
   return reply({ok:true,settings:config,contracts,invoices:vs,messages:ms,accounts:accounts.filter(x=>a.global||x.payload.active).map(x=>({...x,ready:!!merchant(x.id)})),institutions,users,memberships,accessMode:access,global:a.global,manager:manager(a)});
  }
  if(act==='saveSettings'){platform(a);const payload={defaultTrialDays:integer(b.defaultTrialDays,0,3650),collectionEnabled:b.collectionEnabled===true};check(await c.from('hc_billing_settings').update({payload,updated_by:a.username,updated_at:new Date().toISOString()}).eq('key','main'));return reply({ok:true})}
  if(act==='saveAccount'){platform(a);const p=b.payload||{},payload={label:str(p.label,150),provider:p.provider==='mercadopago'?'mercadopago':'transfer',beneficiary:str(p.beneficiary,200),alias:str(p.alias,150),cbu:str(p.cbu,40),active:p.active===true};if(!payload.label)throw Error('Completá el nombre de la cuenta.');const r=b.id?await c.from('hc_billing_accounts').update({payload,updated_by:a.username}).eq('id',str(b.id)).eq('revision',integer(b.revision,1,1e12)).select('*'):await c.from('hc_billing_accounts').insert({payload,updated_by:a.username}).select('*');const data=check(r);if(!data.length)throw Error('La cuenta cambió. Actualizá antes de guardar.');return reply({ok:true,account:data[0]})}
  if(act==='saveContract'){
   platform(a);const i=institution(a,b.institutionId),p=b.payload||{},username=str(b.username)||null,accountId=str(b.accountId)||null;
   if(!check(await c.from('hc_auth_institutions').select('id').eq('id',i).eq('active',true).maybeSingle()))throw Error('Institución no habilitada.');
   if(username&&!check(await c.from('hc_auth_memberships').select('username').eq('username',username).eq('institution_id',i).eq('active',true).maybeSingle()))throw Error('El usuario no pertenece a esta institución.');
   if(accountId&&!check(await c.from('hc_billing_accounts').select('id').eq('id',accountId).maybeSingle()))throw Error('Cuenta no encontrada.');
   const trialDays=integer(p.trialDays,0,3650),start=validDate(p.trialStart),end=p.trialEnd?validDate(p.trialEnd):new Date(Date.parse(start)+trialDays*86400000).toISOString();if(Date.parse(end)<Date.parse(start))throw Error('El fin de prueba es anterior al inicio.');
   const payload={title:str(p.title,200)||'Licencia Hospitalito',amountCents:cents(p.amountCents),trialDays,trialStart:start,trialEnd:end,graceDays:integer(p.graceDays??7,0,365),enabled:p.enabled===true,autoRestrict:p.autoRestrict===true,serviceState:p.serviceState==='read_only'?'read_only':'active',notes:str(p.notes,3000)};
   if(payload.enabled&&(!payload.amountCents||!accountId))throw Error('Para habilitar un acuerdo definí importe y cuenta receptora.');
   const row={institution_id:i,username,account_id:accountId,payload,updated_by:a.username};const r=b.id?await c.from('hc_billing_contracts').update(row).eq('id',str(b.id)).eq('institution_id',i).eq('revision',integer(b.revision,1,1e12)).select('*'):await c.from('hc_billing_contracts').insert(row).select('*');const data=check(r);if(!data.length)throw Error('El acuerdo cambió. Actualizá antes de guardar.');return reply({ok:true,contract:data[0]});
  }
  if(act==='serviceState'){platform(a);const id=str(b.id),current=check(await c.from('hc_billing_contracts').select('*').eq('id',id).single());const payload={...current.payload,serviceState:b.state==='read_only'?'read_only':'active'};const r=check(await c.from('hc_billing_contracts').update({payload,updated_by:a.username}).eq('id',id).eq('revision',b.revision).select('*'));if(!r.length)throw Error('El acuerdo cambió. Actualizá.');return reply({ok:true})}
  if(act==='sendMessage'){platform(a);const i=institution(a,b.institutionId),username=str(b.username)||null,body=str(b.body,4000);if(!body)throw Error('Escribí el mensaje.');if(username&&!check(await c.from('hc_auth_memberships').select('username').eq('institution_id',i).eq('username',username).eq('active',true).maybeSingle()))throw Error('El destinatario no pertenece a la institución.');check(await c.from('hc_billing_messages').insert({institution_id:i,username,body,actor:a.username}));return reply({ok:true})}
  if(act==='checkout'){
   const v=await invoice(c,a,b.invoiceId),config=await settings(c);if(!config.collectionEnabled||v.status!=='pending'||v.paid_cents>=v.amount_cents)throw Error('La liquidación no está habilitada para pagar.');
   const account=check(await c.from('hc_billing_accounts').select('*').eq('id',v.account_id).single()),m=merchant(v.account_id);if(!account.payload.active||account.payload.provider!=='mercadopago'||!m)throw Error('Mercado Pago todavía no fue configurado en el servidor.');
   const id=crypto.randomUUID(),amount=Number(v.amount_cents)-Number(v.paid_cents);check(await c.from('hc_billing_checkouts').insert({id,invoice_id:v.id,account_id:v.account_id,amount_cents:amount}));
   const base='https://walterrigoni.github.io/hospitalito/',notification=Deno.env.get('SUPABASE_URL')+'/functions/v1/hospitalito-finance?webhook=1&account='+encodeURIComponent(v.account_id)+'&forceFunctionRegion=eu-central-1';
   const p=await mpFetch('/checkout/preferences',m,'POST',{items:[{id:v.id,title:v.title,quantity:1,currency_id:'ARS',unit_price:amount/100}],external_reference:id,back_urls:{success:base,pending:base,failure:base},notification_url:notification});
   const target=m.sandbox===true?p.sandbox_init_point:p.init_point;if(!/^https:\/\/(www\.)?(mercadopago\.com\.ar|sandbox\.mercadopago\.com\.ar)\//.test(target||''))throw Error('El proveedor devolvió un enlace no válido.');
   check(await c.from('hc_billing_checkouts').update({preference_id:p.id}).eq('id',id));return reply({ok:true,url:target,checkoutId:id});
  }
  if(act==='refreshPayment'){const v=await invoice(c,a,b.invoiceId);const settled=await settleMP(c,v.account_id,str(b.paymentId),a,v.id);return reply({ok:true,invoice:settled})}
  if(act==='reportPayment'){const v=await invoice(c,a,b.invoiceId),reference=str(b.reference,1000);if(!reference)throw Error('Ingresá la referencia del comprobante.');check(await c.from('hc_billing_messages').insert({institution_id:v.institution_id,username:v.username,actor:a.username,body:`Pago informado por @${a.username} · liquidación ${v.id} · ${reference}. Pendiente de verificación del cobro.`}));return reply({ok:true})}
  if(act==='manualPayment'){platform(a);const v=await invoice(c,a,b.invoiceId),amount=cents(b.amountCents);if(!amount||!str(b.reference)||!/^[0-9a-f-]{36}$/.test(str(b.paymentId)))throw Error('Completá el importe y la referencia del cobro recibido.');const data=check(await c.rpc('hc284_apply_payment',{p_invoice:v.id,p_account:v.account_id,p_provider:'manual',p_payment_id:b.paymentId,p_amount:amount,p_status:'approved',p_reference:str(b.reference,1000),p_actor:a.username}));return reply({ok:true,invoice:data})}
  if(act==='ledger'){
   if(!manager(a))throw Error('Sólo Administración y Contador pueden acceder a Contabilidad.');const i=institution(a,b.institutionId),entries=await rows(c.from('hc_accounting_entries').select('*').eq('institution_id',i).order('updated_at',{ascending:false}));return reply({ok:true,entries});
  }
  if(act==='saveEntry'){
   if(!manager(a))throw Error('Tu rol no puede registrar movimientos contables.');const i=institution(a,b.institutionId),p=b.payload||{},payload={type:p.type==='egreso'?'egreso':'ingreso',date:validDate(p.date).slice(0,10),amountCents:cents(p.amountCents),category:str(p.category,100),counterparty:str(p.counterparty,200),reference:str(p.reference,200),notes:str(p.notes,2000),status:p.status==='void'?'void':'recorded'};if(!payload.amountCents||!payload.category)throw Error('Completá importe y categoría.');
   const r=b.id?await c.from('hc_accounting_entries').update({payload,updated_by:a.username}).eq('id',str(b.id)).eq('institution_id',i).eq('revision',b.revision).select('*'):await c.from('hc_accounting_entries').insert({institution_id:i,payload,updated_by:a.username}).select('*');const data=check(r);if(!data.length)throw Error('El movimiento cambió. Actualizá.');return reply({ok:true,entry:data[0]});
  }
  if(act==='layout'||act==='saveLayout'){
   const i=institution(a,b.institutionId);if(!a.global&&a.role!=='admin')throw Error('Sólo Administración puede configurar servicios y camas.');const inst=check(await c.from('hc_auth_institutions').select('data_institution_id').eq('id',i).single()),dataId=inst.data_institution_id||i;
   if(act==='layout'){const layout=check(await c.from('hc_institution_layouts').select('*').eq('institution_id',i).maybeSingle()),beds=check(await c.from('hc_state').select('payload').eq('institution_id',dataId).eq('bucket','beds').eq('record_id','main').maybeSingle());return reply({ok:true,layout,beds:beds?.payload?.value||[]})}
   const rawBeds=b.payload?.beds,services=b.payload?.services;if(!Array.isArray(rawBeds)||!Array.isArray(services)||services.length>100)throw Error('Servicios inválidos.');const payload={services:services.map((s:any)=>({name:str(s.name,100)})),beds:rawBeds.map((x:any)=>({id:str(x.id,100),area:str(x.area,100),label:str(x.label,100)}))};if(new Set(payload.services.map(x=>x.name.toLowerCase())).size!==payload.services.length||payload.services.some(x=>!x.name)||payload.beds.some(x=>!payload.services.some(s=>s.name===x.area)))throw Error('Los nombres de servicios deben ser únicos y corresponder a las camas.');
   const data=check(await c.rpc('hc284_save_layout',{p_institution:i,p_actor:a.username,p_expected:integer(b.revision??0,0,1e12),p_payload:payload}));return reply({ok:true,...data});
  }
  return reply({ok:false,error:'Acción no reconocida.'},400);
 }catch(e){return reply({ok:false,error:String((e as any)?.message||e)},400)}
});
