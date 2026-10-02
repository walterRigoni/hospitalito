const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const path=require('node:path');
function exercise(html){
  function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,start);return html.slice(a,b);}
  const context=vm.createContext({console});
  vm.runInContext(`
    const data=new Map();let reads=0,writes=0;
    const localStorage={getItem(k){reads++;return data.get(k)||null;},setItem(k,v){writes++;data.set(k,String(v));}};
    const LS={pharmacyDrugs:'drugs',globalAuthCurrentInstitution:'institution',backendDataScope:'scope'},session={institutionId:'A'};
    function getCurrentUser(){return {role:'medico'};}
    function loadJSON(k,f){const r=localStorage.getItem(k);return r?JSON.parse(r):f;}
    function saveJSON(k,v){localStorage.setItem(k,JSON.stringify(v));}
    function hcBackendMarkLocalSavedSoon(){}function hcBackendScheduleUrgentPush(){}
    function isoNowLocalFull(){return '2026-10-02T19:30:00';}
    const pharmacyDrugDisplayName=d=>d.nombre;
    const pharmacyDrugSearchText=d=>[d.nombre,...d.presentaciones.map(p=>p.label)].join(' ');
    ${section('  function hcProtocolSafeId(', '  function hcProtocolUnitParts(')}
    ${section('  function hcNormalizeGenericDrugProtocol(', '  function normalizePharmacyDrugObject(')}
    const INFUSION_DRUGS=Array.from({length:200},(_,i)=>({id:'drug'+i,nombre:i===0?'Enoxaparina':'Medicamento '+i,
      enabled:true,presentaciones:[{id:'p'+i,label:i===0?'60 mg jeringa':'10 mg ampolla'}],
      protocolProfiles:[{profileId:'p',profileName:'Profilaxis',enabled:true,via:'SC',minDose:1,mediaDose:2,maxDose:3}]}));
    localStorage.setItem(LS.pharmacyDrugs,JSON.stringify(INFUSION_DRUGS));
    reads=0;writes=0;
  `,context);
  const start=performance.now();
  vm.runInContext(`for(let i=0;i<12;i++)hcPrescriptionChoiceRows(i%2?'enoxa':'medicamento');`,context);
  const ms=performance.now()-start;
  assert.equal(vm.runInContext(`hcPrescriptionChoiceRows('enoxaparina 60')[0].drug.id`,context),'drug0');
  assert.equal(vm.runInContext(`hcPrescriptionChoiceRows('enoxaparina 60')[0].presentation.id`,context),'p0');
  assert.equal(vm.runInContext(`hcPrescriptionChoiceRows('enoxaparina 99').length`,context),0);
  const stats=vm.runInContext('({reads,writes})',context);
  return {...stats,ms:Number(ms.toFixed(2))};
}
const current=exercise(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'));
assert.equal(current.reads,0,'Searching must not read/reconcile every protocol store');
assert.equal(current.writes,0,'Searching must not write protocol data');
console.log('PASS search returns matching presentation and performs no protocol storage work',current);
if(process.argv[2]){
  const baseline=exercise(fs.readFileSync(process.argv[2],'utf8'));
  console.log(JSON.stringify({syntheticCatalogDrugs:200,searches:12,baseline,current,speedup:Number((baseline.ms/current.ms).toFixed(1))}));
}
