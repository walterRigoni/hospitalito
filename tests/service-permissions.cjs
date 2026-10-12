const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
function context(file){const source=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../supabase/functions',file,'index.ts'),'utf8').replace(/^import[^\n]*\n/gm,'')),c=vm.createContext({console,Date,TextEncoder,Uint8Array,crypto:globalThis.crypto,Response,Request,Deno:{serve(){},env:{get(){return ''}}},createClient(){throw Error('Network not used in these tests')}});vm.runInContext(source,c);return c}
const care=context('hospitalito-care'),services=context('hospitalito-services');
const unchanged={payload:{value:[{id:'old',text:'Prior evolution'}]},deleted:false};
const db={from(){return{select(){return this},eq(){return this},async maybeSingle(){return{data:unchanged,error:null}}}}};
const row=(field,value,deleted=false)=>({bucket:'clinical',record_id:'patient::'+field,payload:{value},deleted});
(async()=>{
 for(const [role,own]of [['kinesiologo','kinesiologiaEvolutions'],['hemoterapia','hemotherapyEvolutions'],['nutricionista','nutritionEvolutions']]){
  assert.equal((await care.authorizedRows(db,'facility',[row(own,[{id:'new'}])],role)).length,1);
  await assert.rejects(care.authorizedRows(db,'facility',[row('prescripciones',{})],role),/consultar/);
  await assert.rejects(care.authorizedRows(db,'facility',[row(own,[],true)],role),/consultar/);
  assert.equal((await care.authorizedRows(db,'facility',[row('evolucionesFull',unchanged.payload.value)],role)).length,0,'Unchanged history can be replayed without writing');
 }
 assert(services.permit('hemoterapia','donor'));assert(!services.permit('medico','donor'));assert(services.permit('medico','consent_patient'));assert(!services.permit('enfermero','consent_patient'));
 assert.throws(()=>services.clean('donor',{name:'Synthetic',document:'TEST',patientId:'p'}),/justificación/);
 const unit={code:'TEST-001',component:'Plasma',origin:'Synthetic center',expiresAt:new Date(Date.now()+86400000).toISOString(),status:'Cuarentena'};
 assert.equal(services.clean('blood_unit',unit).status,'Cuarentena');
 assert.throws(()=>services.clean('blood_unit',{...unit,status:'Disponible'}),/validación/);
 assert.throws(()=>services.clean('blood_unit',{...unit,status:'Reservada',responsible:'Test professional',compatibility:'Test validation'}),/receptor/);
 assert.throws(()=>services.clean('blood_unit',{...unit,status:'Disponible',responsible:'Test professional',compatibility:'Test validation',expiresAt:'2020-01-01'}),/vencida/);
 console.log('PASS: service permissions, unchanged history, donor justification and blood-unit validation.');
})().catch(e=>{console.error(e);process.exit(1)});

