const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
assert(html.includes('hospitalito-telemed?forceFunctionRegion=eu-central-1'));
const section=html.slice(html.indexOf('const profileStatus=el.querySelector'),html.indexOf("q('#hc292Connect').onclick=e=>",html.indexOf('const profileStatus=el.querySelector')));
function field(value='',checked=false){return {value,checked,required:false};}
function mode(name){const inputs={'[data-enabled]':field('',true),'[data-active]':field('',true),'[data-start]':field('08:00'),'[data-end]':field('12:00')};const row={dataset:{day:'1'},querySelector:s=>inputs[s]};const rate={value:'15000',dataset:{rate:'30'}};return {dataset:{mode:name},inputs,rate,querySelector:s=>inputs[s],querySelectorAll:s=>s==='[data-day]'?[row]:s==='[data-rate]'?[rate]:[]};}
(async()=>{let checks=0;for(const scenario of ['save','invalid-time','missing-price','missing-address','server-error','unconfirmed','private','repeat']){
 const boxes=[mode('telemedicine'),mode('office')],status={textContent:'',scrollIntoView(){}};
 const elements={specialty:field('Cardiología'),credential:field('FICTICIA'),description:field('Prueba'),address:field('CONSULTORIO FICTICIO'),public_visible:field('',scenario!=='private'),consent:field('',true)};
 if(scenario==='invalid-time')boxes[0].inputs['[data-end]'].value='07:00';
 if(scenario==='missing-price')boxes[1].rate.value='';
 if(scenario==='missing-address')elements.address.value='';
 let calls=[],cleared=0;
 const edit={},save={};const f={querySelector:()=>save,elements,append(){},addEventListener(){},checkValidity:()=>true,querySelectorAll:s=>s==='[data-mode]'?boxes:s==='input,select,textarea'?Object.values(elements):[]};
 const c={f,el:{querySelector:s=>s==='#hc296EditSchedule'?edit:status},days:['Domingo','Lunes'],profile:{revision:4},profileStatus:status,saveDraft(){},draftKey:'test',sessionStorage:{getItem(){return null;},removeItem(){cleared++;}},Number,Error,console,run:async(b,fn,st)=>{try{await fn();}catch(e){st.textContent=e.message;}},q:()=>status,api:async(a,b)=>{calls.push({a,b});if(scenario==='server-error')throw Error('Servidor no disponible');return scenario==='unconfirmed'?{ok:true}:{profile:{...b.profile,revision:b.revision+1}};}};
 // profileStatus is declared by the production code.
 delete c.profileStatus;vm.createContext(c);vm.runInContext(section,c);assert.equal(save.hidden,true);assert.equal(elements.credential.disabled,true);edit.onclick();assert.equal(save.hidden,false);assert.equal(elements.credential.disabled,false);elements.consent.checked=true;
 f.onsubmit({preventDefault(){},submitter:{}});await new Promise(resolve=>setImmediate(resolve));
 const invalid=['invalid-time','missing-price','missing-address'].includes(scenario);
 assert.equal(calls.length,invalid?0:1,scenario+': '+status.textContent);
 if(invalid||['server-error','unconfirmed'].includes(scenario)){assert.equal(cleared,0);assert(!status.textContent.includes('guardados en el servidor'));}
 else {assert.equal(cleared,1,status.textContent);assert.equal(calls[0].b.profile.modes.office.rates[0].amount_cents,1500000);assert(status.textContent.includes('guardados en el servidor'));if(scenario==='private')assert(status.textContent.includes('sin publicar'));}
 if(scenario==='repeat'){f.onsubmit({preventDefault(){},submitter:{}});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls[1].b.revision,5);}
 checks++;console.log('PASS '+scenario);
}console.log(checks+' save-flow checks passed');})().catch(e=>{console.error(e);process.exit(1)});
