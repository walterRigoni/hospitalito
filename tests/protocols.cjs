// Regression checks against the protocol functions shipped in index.html.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  assert(a >= 0 && b > a, `Missing source section: ${start}`);
  return html.slice(a, b);
}
function environment() {
  const memory = new Map();
  const context = vm.createContext({console, localStorage: {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value))
  }});
  const source = `
    const LS={pharmacyDrugs:'drugs',globalAuthCurrentInstitution:'institution',backendDataScope:'scope'};
    const session={institutionId:'test'};
    const window={}; let role='medico';
    function getCurrentUser(){return {role,username:'doctor',name:'Doctor'};}
    function isoNowLocalFull(){return '2026-10-02T22:00:00.000Z';}
    function hcBackendRecordTs(row){
      if(!row || typeof row!=='object')return 0;
      return Math.max(0,...Object.entries(row).map(([k,v])=>
        typeof v==='object'?hcBackendRecordTs(v):(['updatedAt','deletedAt'].includes(k)?Date.parse(v)||0:0)));
    }
    function hcBackendMarkLocalSavedSoon(){} function hcBackendScheduleUrgentPush(){}
    function loadJSON(key,fallback){const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}
    function saveJSON(key,value){
      const next=key===LS.pharmacyDrugs?protectPharmacyWrite(value,loadJSON(key,[])):value;
      localStorage.setItem(key,JSON.stringify(next));
    }
    function recTs(row){return hcBackendRecordTs(row);}
    ${section('  function protectPharmacyWrite(', '  function cleanOnlyTransientDrafts(')}
    ${section('  function hcProtocolSafeId(', '  function hcProtocolUnitParts(')}
    ${section('  function hcNormalizeGenericDrugProtocol(', '  function hcProtocolChoiceValue(')}
    const DEFAULT_INFUSION_DRUGS=[],PHARMACY_CATALOG_ALL=[],INFUSION_DRUGS=[];
    function getPharmacyCatalog(){return loadJSON(LS.pharmacyDrugs,[]).map(d=>({...d,
      protocolProfiles:hcNormalizeProtocolProfiles(d.protocolProfiles,d.protocol,d)}));}
    function setPharmacyCatalog(rows){saveJSON(LS.pharmacyDrugs,rows.map(d=>({...d,
      protocolProfiles:hcNormalizeProtocolProfiles(d.protocolProfiles,d.protocol,d)})));}
    ${section('  function hcRefreshLiveDrugFromCatalog(', '  function showGenericDrugProtocolModal(')}
    const base={id:'test-drug',nombre:'Test',presentaciones:[{id:'amp',label:'Ampolla'}],stockQty:25};
    function profile(id,name,extra={}){return hcNormalizeGenericDrugProtocol({profileId:id,profileName:name,
      enabled:true,via:'SC',doseUnit:'mg',minDose:1,mediaDose:2,maxDose:3,
      updatedAt:'2026-10-01T10:00:00Z',...extra},base);}
    function seed(profiles,extra={}){const d={...base,...extra,protocolProfiles:profiles,protocol:profiles[0]||{}};
      localStorage.setItem(LS.pharmacyDrugs,JSON.stringify([d]));return d;}
    function rows(){return loadJSON(LS.pharmacyDrugs,[])[0].protocolProfiles;}
    function active(){return hcProtocolProfilesForDrug(getPharmacyCatalog()[0]);}
  `;
  vm.runInContext(source, context);
  return code => vm.runInContext(code, context);
}
const cases = [
  ['delete only Profilaxis; repeated clicks and reload stay deleted', `
    seed([profile('profilaxis','Profilaxis'),profile('combined','Profilaxis y anticoagulación')]);
    for(let i=0;i<10;i++){
      if(!hcDeleteGenericDrugProtocol(base.id,'profilaxis'))throw Error('Deletion failed');
      if(active().length!==1 || active()[0].profileId!=='combined')throw Error('Wrong remaining protocol');
    }
    if(rows().length!==2 || rows().filter(p=>p.deletedAt).length!==1)throw Error('Duplicates accumulated');
    hcProtocolStoreSetProfiles(base.id,[]);hc267ProtocolCatalogSnapshot=null;
    if(active().length!==1)throw Error('Reload resurrected deletion');
    if(loadJSON(LS.pharmacyDrugs,[])[0].stockQty!==25)throw Error('Catalog changed');
  `],
  ['stale replica with a later clock cannot resurrect a deleted identifier', `
    const old=profile('profilaxis','Profilaxis');seed([old]);
    hcDeleteGenericDrugProtocol(base.id,'profilaxis');
    seed([{...old,updatedAt:'2026-10-03T00:00:00Z'}]);
    if(active().length)throw Error('Deleted protocol resurrected');
  `],
  ['saving an old open form after deletion cannot create another modality', `
    const old=profile('profilaxis','Profilaxis');seed([old]);hcDeleteGenericDrugProtocol(base.id,'profilaxis');
    if(hcSaveGenericDrugProtocol(base.id,old,'profilaxis')!==null)throw Error('Stale form created a copy');
    if(active().length)throw Error('Stale form resurrected protocol');
  `],
  ['protocol deletion survives pharmacy timestamps later than the device clock', `
    seed([profile('profilaxis','Profilaxis'),profile('combined','Profilaxis y anticoagulación')],
      {updatedAt:'2026-10-03T12:00:00Z'});
    if(!hcDeleteGenericDrugProtocol(base.id,'profilaxis'))throw Error('Catalog rejected deletion');
    if(active().length!==1 || active()[0].profileId!=='combined')throw Error('Wrong remaining protocol');
  `],
  ['stale render preserves protocols already saved by another tab', `
    const stale=seed([profile('profilaxis','Profilaxis')]);
    seed([profile('profilaxis','Profilaxis'),profile('combined','Profilaxis y anticoagulación')]);
    if(hcProtocolProfilesForDrug(stale).length!==2)throw Error('Stale render lost a saved protocol');
    if(rows().filter(p=>!p.deletedAt).length!==2)throw Error('Saved protocol overwritten');
  `],
  ['identical historic copies consolidate; differing doses remain separate', `
    seed([profile('profilaxis','Profilaxis'),profile('profilaxis_2','Profilaxis'),
      profile('combined','Profilaxis y anticoagulación'),profile('different','Profilaxis',{maxDose:4})]);
    if(active().length!==3)throw Error('Incorrect consolidation');
    if(!hcDeleteGenericDrugProtocol(base.id,'profilaxis_2'))throw Error('Alias deletion failed');
    if(active().length!==2 || !active().some(p=>p.maxDose===4))throw Error('Different dose lost');
  `],
  ['new explicit modality and editing a survivor do not reuse deleted identities', `
    const old=profile('profilaxis','Profilaxis');seed([old,profile('combined','Profilaxis y anticoagulación')]);
    hcDeleteGenericDrugProtocol(base.id,'profilaxis');
    const created=hcSaveGenericDrugProtocol(base.id,old,'');
    if(!created || created.profileId==='profilaxis')throw Error('Deleted identity reused');
    hcSaveGenericDrugProtocol(base.id,profile('combined','Profilaxis y anticoagulación',{mediaDose:2.5}),'combined');
    if(active().length!==2 || active().find(p=>p.profileId==='combined').mediaDose!==2.5)throw Error('Edit duplicated profile');
  `],
  ['non-doctor cannot delete protocols', `
    seed([profile('profilaxis','Profilaxis')]);role='enfermero';
    if(hcDeleteGenericDrugProtocol(base.id,'profilaxis') || active().length!==1)throw Error('Role check failed');
  `]
];
let failed=0;
for(const [label, code] of cases){
  try{environment()(code);console.log('PASS',label);}
  catch(error){failed++;console.error('FAIL',label,':',error.message);}
}
process.exitCode=failed?1:0;
