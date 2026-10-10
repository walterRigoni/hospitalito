const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2]||path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script id="hc282DoctorAlerts">([\s\S]*?)<\/script>/)[1];
const storage=new Map(),reads={},scope='facility',c=vm.createContext({console,session:{username:'alice',role:'medico'},HC_DOCTOR_ALERT_MODULE_LABELS:{},hc265DoctorAlertContext:null,LS:{clinical:'clinical',activity:'activity',backendRegistryId:'institution'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},getClinical:()=>({}),getActivity:()=>[],hcDoctorAlertReadStorageKey:()=>`reads.id:${scope}.${c.session.username}`,hcDoctorLoadAlertReads:()=>reads[c.session.username]||{},hcDoctorAlertEventTimeMs:e=>Date.parse(e?.doctorAlertAt||e?.ts||'')||0,hcDoctorLatestModuleEvent:()=>null,hcDoctorGetUnreadModules:()=>[],hcDoctorRefreshAlertsUI:()=>{},renderPatientHeader:()=>{},document:{querySelector:()=>null},setTimeout:f=>{f();return 1},clearTimeout:()=>{}});c.window=c;c.hc281SyncState=()=>({institucion:scope});
vm.runInContext(source,c);
const at=n=>new Date(1700000000000+n).toISOString();
const row=(field,writer,n=1,pid='p',institution_id=scope)=>({bucket:'clinical',record_id:`${pid}::${field}`,writer,updated_at:at(n),sync_seq:n,revision:n,institution_id});
const unread=pid=>Array.from(c.hcDoctorGetUnreadModules(pid));
function review(pid,module){reads[c.session.username]||={};reads[c.session.username][pid]||={};reads[c.session.username][pid][module]=c.hcDoctorAlertEventTimeMs(c.hcDoctorLatestModuleEvent(pid,module));}
c.hc282ReceiveDoctorAlerts([row('prescripciones','nurse')]);assert.deepEqual(unread('p'),['prescripciones'],'A prefixed local read scope must accept the real institution id');
review('p','prescripciones');assert.deepEqual(unread('p'),[]);
c.hc282ReceiveDoctorAlerts([row('prescripciones','nurse')]);assert.deepEqual(unread('p'),[],'An old response cannot revive a read alert');
c.hc282ReceiveDoctorAlerts([row('prescripciones','alice',2)]);assert.deepEqual(unread('p'),[],'Own change is excluded');
c.hc282ReceiveDoctorAlerts([row('prescripciones','nurse',3),row('labResults','lab',4)]);assert.deepEqual(unread('p').sort(),['laboratorio','prescripciones']);review('p','prescripciones');assert.deepEqual(unread('p'),['laboratorio'],'Module reviews are independent');
c.hc282ReceiveDoctorAlerts([row('balances','nurse',5,'p2'),row('invasiones','nurse',6,'p','foreign')]);assert.deepEqual(unread('p'),['laboratorio']);assert.deepEqual(unread('p2'),['bal']);
c.session.username='bob';assert.deepEqual(unread('p'),[],'Local attention state is personal');c.hc282ReceiveDoctorAlerts([row('prescripciones','nurse',3)]);assert.deepEqual(unread('p'),['prescripciones']);
c.session.username='alice';assert.deepEqual(unread('p'),['laboratorio']);
console.log('PASS: clinical doctor alerts, prefixed scope, author, read/replay, new event, module, patient, institution and user isolation');
