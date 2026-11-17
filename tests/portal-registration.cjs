const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const {webcrypto}=require('node:crypto');
const root=path.dirname(__dirname),tables={},files=new Map();let failTable='',failBack=false,handler;
const rows=name=>tables[name]||(tables[name]=[]);
const wildcard=pattern=>{
 let re='^';for(let i=0;i<pattern.length;i++){let c=pattern[i];if(c==='\\'&&i+1<pattern.length){c=pattern[++i];re+=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}else if(c==='%')re+='.*';else if(c==='_')re+='.';else re+=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}return new RegExp(re+'$','i');
};
class Query{
 constructor(table){this.table=table;this.filters=[];this.mode='select';this.values=null;this.one=false;this.max=Infinity;}
 select(){return this;}eq(k,v){this.filters.push(r=>r[k]===v);return this;}ilike(k,v){const re=wildcard(v);this.filters.push(r=>re.test(r[k]));return this;}
 lt(k,v){this.filters.push(r=>r[k]<v);return this;}in(k,v){this.filters.push(r=>v.includes(r[k]));return this;}
 limit(n){this.max=n;return this;}order(){return this;}single(){this.one=true;return this;}maybeSingle(){this.one=true;return this;}
 insert(v){this.mode='insert';this.values=Array.isArray(v)?v:[v];return this;}delete(){this.mode='delete';return this;}update(v){this.mode='update';this.values=v;return this;}
 then(resolve,reject){return Promise.resolve().then(()=>this.execute()).then(resolve,reject);}
 execute(){
  const all=rows(this.table),filtered=all.filter(r=>this.filters.every(f=>f(r))).slice(0,this.max);
  if(this.mode==='insert'){
   if(this.table===failTable){failTable='';return{data:null,error:{message:'Intentional insert failure'}};}
   if(this.table==='hc_auth_users'&&this.values.some(v=>all.some(r=>r.username===v.username)))return{data:null,error:{code:'23505',message:'Username already exists'}};
   all.push(...structuredClone(this.values));return{data:this.one?this.values[0]:this.values,error:null};
  }
  if(this.mode==='delete')tables[this.table]=all.filter(r=>!filtered.includes(r));
  if(this.mode==='update')filtered.forEach(r=>Object.assign(r,structuredClone(this.values)));
  return{data:this.one?filtered[0]||null:filtered,error:null};
 }
}
const client={from:n=>new Query(n),rpc:async()=>({data:true,error:null}),storage:{from:()=>({
 upload:async(p,bytes,opts)=>{if(failBack&&p.includes('/back/')){failBack=false;return{error:{message:'Intentional reverse upload failure'}};}files.set(p,{bytes,mime:opts.contentType});return{data:{path:p},error:null};},
 remove:async ps=>{ps.forEach(p=>files.delete(p));return{data:[],error:null};},
 download:async p=>{const f=files.get(p);return f?{data:new Blob([f.bytes],{type:f.mime}),error:null}:{error:{message:'Missing document'}};}
})}};
const sandbox={createClient:()=>client,crypto:webcrypto,TextEncoder,Uint8Array,Request,Response,Blob,Date,JSON,Object,Array,String,Number,Set,Map,Math,Error,RegExp,performance,atob,btoa,console:{warn:()=>{},error:()=>{},log:()=>{}},Deno:{env:{get:k=>({'SUPABASE_URL':'https://example.invalid','SUPABASE_SECRET_KEYS':'{"default":"local-test-secret"}','SUPABASE_PUBLISHABLE_KEYS':'{"default":"local-test-publishable"}'})[k]},serve:fn=>handler=fn}};
vm.createContext(sandbox);
function load(name){const code=fs.readFileSync(path.join(root,'supabase/functions/hospitalito-'+name+'/index.ts'),'utf8').replace(/^import .*?;\s*/,'');const context=vm.createContext({...sandbox});let fn;context.Deno={...sandbox.Deno,serve:f=>fn=f};vm.runInContext(stripTypeScriptTypes(code),context);return fn;}
const portal=load('portal'),login=load('login'),auth=load('auth');
async function call(fn,action,body={}){const response=await fn(new Request('https://example.invalid',{method:'POST',headers:{apikey:'local-test-publishable','Content-Type':'application/json','x-forwarded-for':'127.0.0.1'},body:JSON.stringify({action,...body})}));return{status:response.status,...await response.json()};}
const front={name:'front.png',data:'data:image/png;base64,'+fs.readFileSync(path.join(root,'tests/fixtures/dni-front-test.png')).toString('base64')},back={name:'back.png',data:'data:image/png;base64,'+fs.readFileSync(path.join(root,'tests/fixtures/dni-back-test.png')).toString('base64')};
const base={username:'ana_01@example.com',password:'local-only-test-password',name:'ANA MARIA PRUEBA',dni:'99000001',dob:'1980-11-14',confirmedData:true,document:front,documentBack:back};
let checks=0;const check=(condition,message)=>{checks++;assert.ok(condition,message)};
(async()=>{
 let result=await call(portal,'register',{...base,documentBack:null});check(result.code==='MISSING_BACK','A reverse photograph is required');check(files.size===0,'Missing reverse creates no files');
 result=await call(portal,'register',{...base,documentBack:front});check(!result.ok&&/iguales/.test(result.error),'The same photograph cannot represent both sides');
 result=await call(portal,'register',base);check(result.ok,'Email usernames can register');check(files.size===2,'Both photographs are saved');
 const row=rows('hc_portal_clients')[0];check(!!row.document_path&&!!row.profile.identityDocuments.back.path,'Both sides remain attached to the owner');
 result=await call(login,'authenticateUser',{username:base.username,password:base.password});check(result.ok&&result.user.role==='cliente','New client can log in through the fast login endpoint');const token=result.token;
 result=await call(auth,'authenticateUser',{username:base.username,password:base.password});check(result.ok&&result.user.role==='cliente','New client can also log in through fallback authentication');
 result=await call(portal,'myIdentityDocuments',{token,username:'someone-else'});check(result.ok&&result.documents.length===2,'A client sees both owned photographs');check(result.documents[0].data===front.data&&result.documents[1].data===back.data,'Document bytes survive upload and retrieval unchanged');
 result=await call(portal,'myIdentityDocuments',{});check(!result.ok&&result.status===403,'Anonymous access is denied');
 result=await call(portal,'identityDocument',{token,username:base.username,institutionId:'another-institution'});check(!result.ok&&result.status>=400,'Clients cannot use the staff identity endpoint');
 const before=row.profile.identityDocuments.back.path;
 result=await call(portal,'updateClientProfile',{token,profile:{address:'Dirección de prueba',email:'new@example.com',identityDocuments:{back:{path:'foreign-document'}}}});check(result.ok&&row.profile.identityDocuments.back.path===before,'Profile edits cannot replace server-owned document paths');
 const count=files.size;result=await call(portal,'register',base);check(result.code==='USERNAME_TAKEN'&&files.size===count,'Duplicate registration preserves existing accounts and photographs');
 // Put the wildcard-like username first to reproduce the original false duplicate/login lookup.
 const existing=structuredClone(rows('hc_auth_users')[0]);existing.username='anax02';rows('hc_auth_users').unshift(existing);
 result=await call(portal,'register',{...base,username:'ana_02'});check(result.ok,'An underscore is treated literally during duplicate checks');
 result=await call(login,'authenticateUser',{username:'ana_02',password:base.password});check(result.ok&&result.user.username==='ana_02','Fast login resolves the exact underscore username');
 result=await call(auth,'authenticateUser',{username:'ana_02',password:base.password});check(result.ok&&result.user.username==='ana_02','Fallback login resolves the exact underscore username');
 const filesBefore=files.size,usersBefore=rows('hc_auth_users').length;
 failTable='hc_portal_clients';result=await call(portal,'register',{...base,username:'failed_insert'});check(!result.ok,'A failed database insert is reported');check(files.size===filesBefore&&rows('hc_auth_users').length===usersBefore,'Failed registration cleans up both files and the partial account');
 failBack=true;result=await call(portal,'register',{...base,username:'failed_upload'});check(!result.ok&&files.size===filesBefore,'A failed reverse upload cleans up the front');
 const concurrency=await Promise.all([call(portal,'register',{...base,username:'concurrent_test'}),call(portal,'register',{...base,username:'concurrent_test'})]);check(concurrency.filter(r=>r.ok).length===1&&concurrency.some(r=>r.code==='USERNAME_TAKEN'),'Concurrent duplicate registrations yield one account');
 check(rows('hc_portal_clients').filter(r=>r.username==='concurrent_test').length===1,'A losing concurrent request cannot remove the successful account');
 const owner=rows('hc_auth_users').find(r=>r.username===base.username);owner.default_role='cliente';
 const legacy=rows('hc_portal_clients').find(r=>r.username===base.username);delete legacy.profile.identityDocuments;
 result=await call(portal,'myIdentityDocuments',{token});check(result.ok&&result.documents.length===1,'Existing single-front accounts remain readable');
 console.log(JSON.stringify({backendChecks:checks,accountsInMemory:rows('hc_auth_users').length,productionWrites:0}));
})().catch(e=>{console.error(e);process.exitCode=1;});
