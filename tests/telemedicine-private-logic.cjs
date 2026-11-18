const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');let source=stripTypeScriptTypes(fs.readFileSync(__dirname+'/../supabase/functions/hospitalito-telemed/logic.ts','utf8'),{mode:'strip'}).replace(/^export /gm,'');const c={};vm.createContext(c);vm.runInContext(source+'\nthis.logic={weekly,cleanProfile,split};',c);const {weekly,cleanProfile}=c.logic;let n=0;function test(name,fn){fn();n++;console.log('PASS '+name)}
const schedule={days:{1:{active:true,windows:[{start:'08:00',end:'12:00',address:'Dirección A'},{start:'14:00',end:'18:00',address:'Dirección B'}]}}};
const p={specialty:'Cardiología',credential:'FICTICIA',public_visible:true,modes:{office:{enabled:true,weekly:schedule,rates:[{minutes:15,amount_cents:200000}]}}};
test('Two office locations retained',()=>assert.equal(cleanProfile(p,'medico').modes.office.weekly.days[1].windows[1].address,'Dirección B'));
test('Reject overlapping windows',()=>assert.throws(()=>weekly({days:{1:{active:true,windows:[{start:'08:00',end:'12:00'},{start:'11:00',end:'13:00'}]}}})));
test('Allow adjacent windows',()=>assert.equal(weekly({days:{1:{active:true,windows:[{start:'08:00',end:'12:00'},{start:'12:00',end:'13:00'}]}}}).days[1].windows.length,2));
test('Reject reversed window',()=>assert.throws(()=>weekly({days:{1:{windows:[{start:'12:00',end:'08:00'}]}}})));
test('Reject missing office address',()=>assert.throws(()=>cleanProfile({...p,modes:{office:{...p.modes.office,weekly:{days:{1:{active:true,start:'08:00',end:'12:00'}}}}}},'medico')));
test('Preserve legacy address',()=>assert.equal(weekly({days:{1:{active:true,start:'08:00',end:'12:00'}}},'LEGACY').days[1].windows[0].address,'LEGACY'));
test('Deactivate and reactivate office',()=>{assert.equal(cleanProfile({...p,public_visible:false,modes:{office:{...p.modes.office,enabled:false}}},'medico').modes.office.enabled,false);assert(cleanProfile(p,'medico').modes.office.enabled)});
test('Reject invalid CBU',()=>assert.throws(()=>cleanProfile({...p,bank_public:{cbu:'123'}},'medico')));
test('Bank details require explicit visibility',()=>assert.equal(cleanProfile({...p,bank_public:{alias:'FICTICIO'}},'medico').bank_public.visible,false));
test('No client role accepted',()=>assert.throws(()=>cleanProfile(p,'cliente')));
test('Reject missing price',()=>assert.throws(()=>cleanProfile({...p,modes:{office:{...p.modes.office,rates:[]}}},'medico')));
test('Reject fractional cents',()=>assert.throws(()=>cleanProfile({...p,modes:{office:{...p.modes.office,rates:[{minutes:15,amount_cents:1.5}]}}},'medico')));
test('Preserve each office GPS point, including zero',()=>{const profile=JSON.parse(JSON.stringify(p));const w=profile.modes.office.weekly.days[1].windows;Object.assign(w[0],{latitude:-31.4,longitude:-64.2});Object.assign(w[1],{latitude:0,longitude:0});const out=cleanProfile(profile,'medico').modes.office.weekly.days[1].windows;assert.equal(out[0].latitude,-31.4);assert.equal(out[1].longitude,0);});
test('Reject unpaired office coordinates',()=>{const profile=JSON.parse(JSON.stringify(p));profile.modes.office.weekly.days[1].windows[0].longitude=0;assert.throws(()=>cleanProfile(profile,'medico'));});
console.log(n+' validation checks passed');
