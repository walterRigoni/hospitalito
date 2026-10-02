const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,start);return html.slice(a,b);}
function timing(){
  const context=vm.createContext({console});
  vm.runInContext(`
    function pad2(n){return String(n).padStart(2,'0');}
    ${section('function hcDateTimeLocalFromDateObj(', '  function hcAddHoursIso(')}
    const elements=new Map();
    function el(id,value='',type='text'){const e={value,type,events:{},addEventListener(n,fn){this.events[n]=fn;}};elements.set('#'+id,e);return e;}
    const start=el('prStartAtInput','2026-10-02T19:30','datetime-local');
    const duration=el('prTreatmentDaysInput','','number');
    const unit=el('prDurationUnitSel','days','select-one');
    const end=el('prEndAtInput','','datetime-local');
    const $=id=>elements.get(id)||null;
    const root={dataset:{prDrug:'enoxaparina'}};const currentDurationUnit='days';
    const isAmiodaronaDrug=()=>false,getDrugMeta=()=>({});
    const isoFromNow=()=>start.value;let refreshes=0;
    function refreshCalc(){refreshes++;}
    ${section('      const prStartPlanDateInput =', '    ["#prAmpInput",')}
    function change(e,value,event='change'){e.value=value;e.events[event]?.();}
  `,context);
  return code=>vm.runInContext(code,context);
}
const run=timing();
run(`change(duration,'7','input');`);
assert.equal(run('end.value'),'2026-10-09T19:30');
run(`change(unit,'hours');`);
assert.equal(run('duration.value'),'168');
assert.equal(run('end.value'),'2026-10-09T19:30');
run(`change(duration,'12','input');`);
assert.equal(run('end.value'),'2026-10-03T07:30');
assert.equal(run('root.dataset.prHours'),'12');
run(`change(start,'2026-10-03T20:15');`);
assert.equal(run('end.value'),'2026-10-04T08:15');
assert.equal(run('root.dataset.prStartTouched'),'1');
run(`change(end,'2026-10-05T08:15');`);
assert.equal(run('duration.value'),'36');
run(`change(unit,'days');`);
assert.equal(run('duration.value'),'1.5');
assert.equal(run('end.value'),'2026-10-05T08:15');
run(`change(duration,'0.5','input');`);
assert.equal(run('end.value'),'2026-10-04T08:15');
run(`change(duration,'','input');`);
assert.equal(run('end.value'),'');
run(`change(duration,'2','input');change(end,'');`);
assert.equal(run('duration.value'),'');
assert.equal(run('root.dataset.prHours'),'');
assert.equal(run('root.dataset.prTreatmentDays'),'');
console.log('PASS start, days/hours, final, conversions, fractional durations and clearing');

for(const name of ['Profilaxis','Anticoagulación']){
  const context=vm.createContext({console,name});
  vm.runInContext(`
    let added=0,rendered=0,scrolled=0;
    const button={dataset:{prQuickProfile:name},addEventListener(event,handler){this.handler=handler;}};
    const root={dataset:{},querySelectorAll(){return [button];},querySelector(id){
      if(id==='#btnAddInfusion')return {click(){added++;}};
      if(id==='#prStartAtInput')return {scrollIntoView(){scrolled++;}};return null;}};
    const currentDrug={id:'enoxaparina'},isMedico=true,isCurrentPlanView=true;
    const hcGenericProtocolForDrug=()=>({enabled:true,via:'SC',profileName:name});
    const pharmacyDrugDisplayName=()=> 'Enoxaparina';
    const isoFromNow=()=> '2026-10-02T19:30';
    function renderPrescripciones(){rendered++;}
    function alert(msg){throw Error(msg);}
    ${section('  root.querySelectorAll("[data-pr-quick-profile]")','  const btnDrugProtocol =')}
    button.handler();
  `,context);
  assert.equal(vm.runInContext('added',context),0);
  assert.equal(vm.runInContext('rendered',context),1);
  assert.equal(vm.runInContext('root.dataset.prModeDetails',context),'1');
  assert.equal(vm.runInContext('root.dataset.prProtocolProfile',context),name);
  console.log('PASS',name,'opens review without creating a prescription');
}

const scheduled=section('${currentRequiresScheduledGrid && !currentProgramada ?', '${currentIVMode ? administrationInfoHTML');
for(const id of ['prStartAtInput','prTreatmentDaysInput','prDurationUnitSel','prEndAtInput'])assert(scheduled.includes('id="'+id+'"'));
assert(scheduled.includes('value="days"')&&scheduled.includes('value="hours"'));
console.log('PASS scheduled medication shows start, duration in days/hours, and final');

// Exercise the actual preview expression: no preparation-hours input exists for SC.
const hoursExpression=section('    const hoursRaw =','    let ampRaw =');
assert.equal(vm.runInNewContext(hoursExpression+'hoursRaw',{$:id=>id==='#prDurationUnitSel'?{value:'hours'}:id==='#prTreatmentDaysInput'?{value:'36'}:null,root:{dataset:{}}}),'36');
console.log('PASS duration in hours remains available to the prescription preview');

// The catalog cache must return independent objects and invalidate on writes/scope changes.
const cacheContext=vm.createContext({structuredClone});
vm.runInContext(`
  let raw=JSON.stringify([{id:'enox',enabled:true,stockQty:4}]),scope='A',normalizations=0;
  const window={},LS={pharmacyDrugs:'drugs'},localStorage={getItem:()=>raw};
  function hcProtocolStoreScope(){return scope;}
  function hc264Clone(x){return structuredClone(x);}
  function loadJSON(){return JSON.parse(raw);}
  function normalizePharmacyDrugObject(row){normalizations++;return {...row};}
  function sortPharmacyCatalogList(rows){return rows;}
  function setPharmacyCatalog(rows){raw=JSON.stringify(rows);}
  ${section('  function getPharmacyCatalog(', '  function setPharmacyCatalog(')}
  const first=getPharmacyCatalog([]);first[0].stockQty=99;
  const second=getPharmacyCatalog([]);
`,cacheContext);
assert.equal(vm.runInContext('second[0].stockQty',cacheContext),4);
assert.equal(vm.runInContext('normalizations',cacheContext),1);
vm.runInContext(`raw=JSON.stringify([{id:'enox',enabled:true,stockQty:8}]);`,cacheContext);
assert.equal(vm.runInContext('getPharmacyCatalog([])[0].stockQty',cacheContext),8);
vm.runInContext(`scope='B';getPharmacyCatalog([]);`,cacheContext);
assert.equal(vm.runInContext('normalizations',cacheContext),3);
console.log('PASS catalog cache preserves independent edits, writes and institution changes');
