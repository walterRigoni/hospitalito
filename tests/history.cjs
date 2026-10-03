const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const script=html.match(/<script id="hc-v270-history">([\s\S]*?)<\/script>/)[1];
const elements=new Map(),handlers={},calls=[],storage=new Map();let writes=0;
function el(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',value:'',checked:true,style:{},addEventListener(type,fn){handlers[id+':'+type]=fn;}});return elements.get(id);}
const db={patients:[],registry:[],archive:[],appointments:[],clinical:{},inst:{line1:'Hospital A',logoData:'data:image/png;base64,QQ=='}};
const ctx=vm.createContext({console,Map,Set,Date,AbortController,setTimeout,clearTimeout,
  document:{title:'',getElementById:el,addEventListener(type,fn,capture){(handlers[type+':'+!!capture]||=[]).push(fn);}},window:{},
  localStorage:{getItem:k=>storage.get(k)||'',setItem(k,v){writes++;storage.set(k,String(v));}},
  session:{username:'medico'},selectedPatientId:'p1',medTab:'historia',LS:{backendRegistryName:'name'},
  hc207Inst:()=> 'A',hc220AuthInstitutionId:()=> 'authA',hc207GlobalToken:()=>storage.get('token')||'',
  hcBackendConfigured:()=>false,hcBackendScopeValidated:true,
  getPatients:()=>structuredClone(db.patients),getRegistry:()=>structuredClone(db.registry),getArchive:()=>structuredClone(db.archive),getAppointments:()=>structuredClone(db.appointments),getClinical:()=>structuredClone(db.clinical),getInst:()=>structuredClone(db.inst),
  hcGlobalStoredInstitutions:()=>[],renderMed:()=>{},renderInstitutionHeader:()=>{},
  hcV189PrettyKey:k=>k,HC221_PATIENT_SYNC_URL:'https://example.test/patient',HC207_PUBLISHABLE:'public',
  hc207RowsToSnapshot:rows=>{const s={clinical:{},patients:[],registry:[],appointments:[],archive:[],inst:{}};for(const r of rows){if(r.deleted)continue;if(r.bucket==='clinical'){const [pid,field]=r.record_id.split('::').map(decodeURIComponent);s.clinical[pid]||={};s.clinical[pid][field]=r.payload.value;}else s[r.bucket]=r.payload.value;}return s;}
});
vm.runInContext(script,ctx);
const run=code=>vm.runInContext(code,ctx),json=code=>JSON.parse(JSON.stringify(run(code)));
const srcA={id:'A',local:true,institution:{id:'A',name:'Hospital A',logoData:'data:image/png;base64,QQ=='},patients:[
  {id:'p1',dni:'30.123.456',lastName:'García',firstNames:'Ana'},
  {id:'p2',dni:'30123456',lastName:'García',firstNames:'Ana'},
  {id:'namesake',dni:'99887766',lastName:'García',firstNames:'Ana'}
],registry:[
  {id:'adm1',patientId:'p1',admDateTime:'2026-01-02T09:00',closedAt:'2026-01-05T10:00',active:false},
  {id:'adm2',patientId:'p2',admDateTime:'2026-10-01T09:00',active:true}
],archive:[{id:'ar1',admissionId:'adm1',patientId:'p1',dni:'30123456',name:'García, Ana',date:'2026-01-05T10:00',destination:'Alta',historySnapshot:{institution:{id:'A',name:'Hospital A en enero',logoData:'data:image/png;base64,Qg=='},patient:{id:'p1',dni:'30123456'},modules:{evolucionesFull:[{id:'archEvo',createdAt:'2026-01-02T10:00',fullText:'Evolución archivada'}],labResults:[{id:'lab1',reportedAt:'2026-01-03T10:00',rows:[{value:'10',unit:'mg'}]}],prescripciones:{infusionesContinuas:[{id:'rxOld',drugName:'Droga anterior'}]}}}}],
appointments:[
  {id:'c1',patientId:'p1',date:'2026-02-02',time:'10:30',status:'atendido',doctorName:'Dra. A'},
  {id:'future',patientId:'p1',date:'2026-12-02',time:'10:30',status:'turno'},
  {id:'g1',patientId:'p1',kind:'guardia',date:'2026-02-03',time:'21:10',status:'traslado',destination:'traslado',destinationDetail:'Conducta completa',finalizedAt:'2026-02-03T23:30'}
],clinical:{p1:{labResults:[{id:'lab1',reportedAt:'2026-01-03T10:00',rows:[{value:'10',unit:'mg'}]}],ambulatorio:{evoluciones:[
  {id:'ce1',appointmentId:'c1',evolucion:'Consulta uno',createdAt:'2026-02-02T10:45',antecedentesSnapshot:{alergias:'A'}},
  {id:'ge1',appointmentId:'g1',encounterType:'guardia',evolucion:'Guardia uno',createdAt:'2026-02-03T21:30'},
  {id:'orphan',appointmentId:'removed',appointmentDate:'2025-05-01',appointmentTime:'14:10',evolucion:'Turno antiguo retirado',createdAt:'2025-05-01T14:15'},
],consultas:{c1:{lastMotivo:'Control',lastEvolucion:'Consulta guardada'},legacy:{lastMotivo:'Consulta legacy',lastSavedAt:'2025-03-02T12:00'}},recetasExternas:[{id:'external1',appointmentId:'c1',reference:'Receta uno'},{id:'external2',appointmentId:'g1',reference:'Receta guardia'}]}},p2:{
  ingresoFull:{createdAt:'2026-10-01T09:10',fullText:'Ingreso actual'},
  evolucionesFull:[{id:'current',createdAt:'2026-10-02T10:00',fullText:'Evolución actual',files:[{name:'Informe',url:'https://example.test/medical.pdf'}]},{id:'wrong',createdAt:'2026-01-02T10:00',fullText:'No pertenece a octubre'},{id:'removedEvo',deleted:true,createdAt:'2026-10-02T09:00'}, {id:'noDate',fullText:'Registro antiguo sin fecha'}],
  prescripciones:{infusionesContinuas:[{id:'r1',startAt:'2026-10-02T08:00',drugName:'Enoxaparina',dose:60,administrations:[{at:'2026-10-02T10:00',value:1}]}]},
  surgicalSheets:[{id:'surgery',createdAt:'2026-10-02T10:00',text:'Foja completa'}],
  balances:[{id:'bal1',dateTime:'2026-10-02T09:00',ingresos:500}],
  imageResults:[{id:'img1',createdAt:'2026-10-02T11:00',report:'Imagen actual'}],
  customModule:[{id:'newMod',createdAt:'2026-10-02T12:00',text:'Módulo futuro'}]
}}};
const srcB={id:'B',local:false,institution:{id:'B',name:'Hospital B',logoData:'data:image/png;base64,Qw=='},patients:[
  {id:'p1',dni:'11223344',name:'Otra persona con ID p1'},
  {id:'otherAna',dni:'30123456',name:'Ana García'}
],registry:[{id:'b1',patientId:'otherAna',admDateTime:'2025-12-01T10:00',active:false,closedAt:'2025-12-03T10:00'},{id:'idCollision',patientId:'p1',admDateTime:'2026-01-01T10:00',active:true}],archive:[],appointments:[],clinical:{otherAna:{evolucionesFull:[{id:'bEvo',createdAt:'2025-12-02T10:00',fullText:'Historia B'}]}}};
ctx.fixtures=[srcA,srcB];
run(`const index=hc270PatientIndex(fixtures);const ana=index.find(p=>p.key==='dni:30123456');const model=hc270BuildModel(ana,fixtures);`);
assert.equal(json('index.length'),3);
assert.equal(json(`hc270SearchIndex(index,'garcia ana').length`),2,'namesakes remain distinct');
assert.equal(json(`hc270SearchIndex(index,'Ana García').length`),2);
assert.equal(json(`hc270SearchIndex(index,'30.123.456').length`),1);
assert.equal(json(`ana.refs.length`),3,'readmissions with new ID and same DNI join');
assert.equal(json(`model.internaciones.length`),3,'current, archived and permitted other institution');
assert.ok(!json(`model.internaciones.map(e=>e.record.id)`).includes('idCollision'));
assert.equal(json(`model.consultorio.length`),3,'attended, orphan and legacy notes; no future booking');
assert.equal(json(`model.guardia.length`),1);
assert.equal(json(`model.laboratorio.length`),1,'archived and live result deduplicate');
assert.equal(json(`model.internaciones.find(e=>e.record.id==='adm1').institution.name`),'Hospital A en enero');
assert.equal(json(`model.internaciones.find(e=>e.record.id==='adm1').institution.logoData`),'data:image/png;base64,Qg==');
assert.equal(json(`hc270EpisodeModules(model.internaciones.find(e=>e.record.id==='adm1'),fixtures[0]).evolucionesFull[0].fullText`),'Evolución archivada');
assert.equal(json(`hc270EpisodeModules(model.internaciones.find(e=>e.record.id==='adm2'),fixtures[0]).evolucionesFull.length`),1,'old, deleted and undated records do not leak into current episode');
assert.equal(json(`hc270EpisodeModules(model.internaciones.find(e=>e.record.id==='adm2'),fixtures[0]).prescripciones.infusionesContinuas[0].administrations.length`),1,'keep whole prescription including administration');
assert.equal(json(`hc270EpisodeModules(model.internaciones.find(e=>e.record.id==='adm2'),fixtures[0]).customModule[0].text`),'Módulo futuro');
assert.equal(json(`model.unassigned.length`),1);
assert.equal(json(`hc270Undated({infusionesContinuas:[{id:'undated',dose:10},{id:'dated',startAt:'2026-10-02T10:00',dose:20}]}).infusionesContinuas.length`),1,'preserve older prescriptions without inventing an episode');
assert.equal(json(`hc270EpisodeModules(model.consultorio.find(e=>e.record.id==='c1'),fixtures[0]).evolucionesFull.length`),1);
assert.equal(json(`hc270EpisodeModules(model.consultorio.find(e=>e.record.id==='c1'),fixtures[0]).recetasExternas.length`),1);
assert.equal(json(`hc270EpisodeModules(model.guardia[0],fixtures[0]).atencion.destinationDetail`),'Conducta completa');
assert.equal(json(`hc270Slice([{appointmentId:'g1',createdAt:'2026-10-02T10:00'}],model.internaciones.find(e=>e.record.id==='adm2')).length`),0);
assert.equal(json(`hc270Slice([{admissionId:'adm1',createdAt:'2026-10-02T10:00'}],model.internaciones.find(e=>e.record.id==='adm2')).length`),0);
assert.equal(json(`hc270Slice([{admissionId:'adm2'}],model.internaciones.find(e=>e.record.id==='adm2')).length`),1,'explicit ID works without date');
assert.equal(json(`hc270Slice([{createdAt:'2026-02-02T10:50'}],{...model.consultorio.find(e=>e.record.id==='c1'),requireLink:true}).length`),0,'unknown consultation duration does not borrow same-day records');
assert.deepEqual(json(`hc270Slice({fullText:'Unknown date'},{record:{id:'x'},type:'internaciones',date:'',end:'2026-10-01'} )`),{});
assert.ok(!run(`hc270ValueHTML('<img src=x onerror=alert(1)>')`).includes('<img'));
assert.ok(!run(`hc270ValueHTML('javascript:alert(1)')`).includes('href='));
assert.ok(run(`hc270ValueHTML('https://example.test/result.pdf')`).includes('rel="noopener noreferrer"'));
const lazy=run(`hc270ValueHTML(Array.from({length:5000},(_,i)=>({id:String(i),fullText:'CONTENT '+i})))`);
assert.equal((lazy.match(/<details/g)||[]).length,25);
assert.ok(!lazy.includes('CONTENT 4999'));
assert.ok(lazy.includes('Ver más registros (4975)'));
assert.ok(run(`hc270Date('2026-10-03T14:30:00Z')`).includes('11:30'));
assert.equal(writes,0,'history indexing/reading/rendering never saves clinical data');
console.log('PASS identity, discharge, consultations, guardia, labs, complete modules, attachment escaping and lazy rendering');

async function integration(){
  Object.assign(db,structuredClone({patients:srcA.patients,registry:srcA.registry,archive:srcA.archive,appointments:srcA.appointments,clinical:srcA.clinical}));
  el('hc270OtherInstitutions').checked=false;el('hc270PatientQuery').value='30123456';
  await run(`hc270SearchPatients()`);
  assert.ok(el('hc270SearchResults').innerHTML.includes('García'));
  assert.equal(json('hc270State.searchRows.length'),1);
  run(`hc270SelectIdentity(hc270State.searchRows[0],true)`);
  assert.equal(run('selectedPatientId'),null,'search opens read-only context without registering a new patient');
  await run('hc270LoadHistory()');
  assert.equal(json('hc270State.model.internaciones.length'),2,'unchecked other institutions really excluded');
  assert.ok(el('medHistoria').innerHTML.includes('Internaciones (2)'));
  assert.equal(run('hc270HistoryHeader()'),true);
  assert.ok(el('pacHdrBar').innerHTML.includes('30123456')||el('pacHdrBar').innerHTML.includes('30.123.456'));
  run(`hc270State.episode=hc270State.model.internaciones.find(e=>e.record.id==='adm1').key;hc270Draw()`);
  assert.ok(el('medHistoria').innerHTML.includes('Hospital A en enero'));
  assert.ok(el('medHistoria').innerHTML.includes('Evoluciones médicas'));
  assert.equal(writes,0);
  const token=el('medHistoria').innerHTML.match(/data-hc270-value="(\d+)"/)[1],body={innerHTML:''};
  const detail={open:true,dataset:{hc270Value:token},matches:()=>true,querySelector:()=>body};
  handlers['toggle:true'][0]({target:detail});assert.ok(body.innerHTML.includes('admDateTime'));
  const rendered=body.innerHTML;handlers['toggle:true'][0]({target:detail});assert.equal(body.innerHTML,rendered,'expanded data does not rebuild on repeated toggle events');
  run(`const stampFixture=[{id:'old'},{id:'new'}];hc270StampNewRecords(stampFixture,[{id:'old'}]);`);
  assert.equal(run(`stampFixture[0].historyInstitution`),undefined);
  assert.equal(json(`stampFixture[1].historyInstitution.name`),'Hospital A');

  storage.set('token','global');
  let bootstrapCount=0;
  ctx.hcGlobalAccountRequest=async(action,payload)=>{calls.push({action,...payload});return {backend:{id:'dataB'},institution:{name:'Hospital remoto',logoData:'data:image/png;base64,Qg=='}};};
  ctx.hc207Fetch=async payload=>{calls.push(payload);if(payload.action==='bootstrap'){bootstrapCount++;return {syncToken:'independent',dataInstitutionId:payload.dataInstitutionId};}return {rows:[{bucket:'patients',payload:{value:[{id:'rp',dni:'30123456',name:'Ana García'}]}},{bucket:'inst',payload:{value:{line1:'Hospital remoto'}}}]};};
  ctx.fetch=async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return {ok:true,json:async()=>({ok:true,rows:[{bucket:'clinical',record_id:'rp::ambulatorio',payload:{value:{evoluciones:[{id:'remoteEvo',appointmentId:'remoteTurn',createdAt:'2025-12-02T10:00',evolucion:'Atención remota'}]}}}]})};};
  run('hc270CheckScope()');
  const scope=run('hc270Scope()');ctx.scopeFixture=scope;
  await run(`hc270RemoteSource({id:'authB',name:'Hospital remoto'},scopeFixture).then(s=>hc270State.sources.set(s.id,s))`);
  await run(`hc270ReadClinical(hc270State.sources.get('dataB'),'rp')`);
  assert.equal(calls.find(c=>c.action==='bootstrap').institutionId,'authB');
  assert.equal(calls.find(c=>c.action==='bootstrap').dataInstitutionId,'dataB');
  assert.equal(calls.find(c=>c.url).body.institutionId,'dataB');
  assert.deepEqual(calls.find(c=>c.url).body.fields,[],'all patient fields, including image results and ambulatorio');
  assert.equal(run('hc207Inst()'),'A','remote history never switches institution');
  assert.equal(writes,0);
  assert.equal(bootstrapCount,1);
  ctx.hc207Fetch=async()=>{throw Error('Sin acceso a institución');};
  await assert.rejects(run(`hc270RemoteSource({id:'denied'},scopeFixture)`),/Sin acceso/);

  // Resolver una petición antigua después de cambiar la sesión no puede mostrar datos.
  let resolveRequest;ctx.hcGlobalAccountRequest=()=>new Promise(resolve=>resolveRequest=resolve);
  const stale=run(`hc270RemoteSource({id:'B'},scopeFixture)`);
  storage.set('token','changed');resolveRequest({backend:{id:'B'}});
  await assert.rejects(stale,/sesión cambió/);
  run('hc270CheckScope()');assert.equal(json('hc270State.sources.size'),0);assert.equal(el('medHistoria').innerHTML,'');
  console.log('PASS search/read-only view, permission bootstrap, distinct auth/data IDs, full targeted read and session isolation');
}
assert.match(html,/const CURRENT_VERSION = 270;/,'update detector must compare against the delivered version');
assert.equal((html.match(/id="hc-v270-history"/g)||[]).length,1);
assert.match(html,/show\("#medHistoria", medTab==="historia"\)/);
integration().catch(e=>{console.error(e);process.exitCode=1;});
