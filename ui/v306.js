
/* v306: continuity, saved assessments and compact clinical work. */
(()=>{'use strict';
const q=s=>document.querySelector(s),esc=v=>escHTML(String(v??''));
window.HC_DEMO_VERSION='v306';document.title='Hospitalito · Historia Clínica Digital · v306';
const institution=()=>String(session?.institutionId||localStorage.getItem(LS.backendRegistryId)||'local'),actor=()=>String(session?.username||''),scope=()=>actor()+'|'+institution();
function notice(message){(window.hc289Toast||window.toast||alert)(message);}
function dialog(title,body){
 const overlay=document.createElement('div');overlay.className='hc306Dialog';overlay.innerHTML='<section role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><h3>'+esc(title)+'</h3>'+body+'</section>';
 const previous=document.activeElement;document.body.append(overlay);
 const close=()=>{overlay.remove();if(previous?.isConnected)previous.focus({preventScroll:true});};
 overlay.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);overlay.onclick=e=>{if(e.target===overlay)close();};
 overlay.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const controls=[...overlay.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled),first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
 overlay.querySelector('button,input,select,textarea')?.focus();return {overlay,close};
}
window.hc306CreateCredential=(publicKey,host)=>new Promise((resolve,reject)=>{
 const button=document.createElement('button');button.type='button';button.className='btn primary';button.textContent='Continuar con huella, rostro o PIN';
 const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancelar activación';
 const row=document.createElement('div');row.append(button,cancel);host.querySelector('[data-security-message],[role=status]')?.insertAdjacentElement('beforebegin',row);if(!row.isConnected)host.append(row);
 const cleanup=()=>{clearTimeout(timer);row.remove();},timer=setTimeout(()=>{cleanup();reject(Error('La activación venció. Volvé a intentarlo.'));},110000);
 cancel.onclick=()=>{cleanup();reject(Error('Activación cancelada.'));};
 button.onclick=()=>{button.disabled=true;try{navigator.credentials.create({publicKey}).then(c=>{cleanup();resolve(c);},e=>{cleanup();reject(e);});}catch(e){cleanup();reject(e);}};button.focus();
});
let restoring=false,restored='',routeTimer,seenSession='',pending=null;
function readRoute(){try{return JSON.parse(localStorage.getItem('hc306.route.'+scope())||'null');}catch{return null;}}
function remember(){
 if(!session||restoring||window.hc289ClientSession||pending||restored!==scope())return;
 const state={username:actor(),institution:institution(),patient:String(selectedPatientId||''),tab:medTab,filter:q('#medAreaFilter')?.value||'Todo',pageY:scrollY,panelY:q('#medPanel')?.scrollTop||0,tabX:q('.medModuleTabs')?.scrollLeft||0,evoEditing:['new','edit'].includes(evoUIState)};
 if(q('#medPres'))state.pres=Object.fromEntries(Object.entries(q('#medPres').dataset).filter(([key])=>/^pr|pharmacy/.test(key)));
 try{localStorage.setItem('hc306.route.'+scope(),JSON.stringify(state));localStorage.setItem('hc306.lastUsername',actor());}catch{}
}
function restoreRoute(){
 if(!session||window.hc289ClientSession||restored===scope())return;
 const state=pending||readRoute();if(!state){restored=scope();return;}if(state.username!==actor()||state.institution!==institution())return;
 if(state.patient&&!findPatient(state.patient)){pending=state;return;}restoring=true;pending=null;restored=scope();
 try{selectedPatientId=state.patient||null;if(document.querySelector('[data-medtab="'+CSS.escape(state.tab||'ingreso')+'"]'))medTab=state.tab;
  const filter=q('#medAreaFilter');if(filter&&[...filter.options].some(x=>x.value===state.filter))filter.value=state.filter;
  if(state.pres&&q('#medPres'))Object.assign(q('#medPres').dataset,state.pres);
  renderMed();if(state.evoEditing&&medTab==='evolucion')window.hc280RestoreDraft?.('evolucion');
  requestAnimationFrame(()=>{if(q('#medPanel'))q('#medPanel').scrollTop=state.panelY||0;if(q('.medModuleTabs'))q('.medModuleTabs').scrollLeft=state.tabX||0;scrollTo(0,state.pageY||0);});
 }finally{restoring=false;}
}
window.hc306RememberRoute=remember;window.hc306RestoreRoute=restoreRoute;
document.addEventListener('click',e=>{if(e.target.closest('[data-medtab],#medCenso .censoItem')){pending=null;restored=scope();}clearTimeout(routeTimer);routeTimer=setTimeout(remember,120);});
document.addEventListener('scroll',()=>{clearTimeout(routeTimer);routeTimer=setTimeout(remember,150);},{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){window.hc280PersistDrafts?.();remember();}else restoreRoute();});
window.addEventListener('pagehide',()=>{window.hc280PersistDrafts?.();remember();});
window.addEventListener('pageshow',()=>setTimeout(restoreRoute,100));
const logoutBase=logout;logout=window.logout=function(){remember();pending=null;restored='';return logoutBase.apply(this,arguments);};
function scaleRecords(pid){return (getClinical()?.[pid]?.calculatedScales||[]).filter(x=>!x.deletedAt).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));}
function scaleText(tool,result,at){return tool.title+' · '+dmyhmFromISODateTime(at)+'\n'+(result.score!==undefined?'Puntaje: '+result.score+'/'+result.max+'\n':'')+[...(result.parts||[]),...(result.extra||[])].map(p=>p[0]+': '+p[1]).join('\n')+'\n'+(result.note||'');}

// Merge culture entries by ID, including updates saved within the same second.
const clinicalMergeBase=hcMergeClinicalPatientRecord;
hcMergeClinicalPatientRecord=window.hcMergeClinicalPatientRecord=function(local,remote){
 const merged=clinicalMergeBase.apply(this,arguments),records=new Map();
 for(const row of [...(local?.microResults||[]),...(remote?.microResults||[])]){
  if(!row)continue;const id=String(row.id||row.requestId||'');if(!id)continue;const previous=records.get(id);
  if(!previous){records.set(id,{...row,entries:[...(row.entries||[])]});continue;}
  const latest=new Date(row.updatedAt||row.startedAt||'').getTime()>=new Date(previous.updatedAt||previous.startedAt||'').getTime()?row:previous;
  const entries=[...new Map([...(previous.entries||[]),...(row.entries||[])].map(e=>[e.id||[e.at,e.by,e.stage,e.growth,e.note].join('|'),e])).values()].sort((a,b)=>String(a.at||'').localeCompare(String(b.at||''))||Number(a.stage==='Resultado definitivo')-Number(b.stage==='Resultado definitivo'));
  records.set(id,{...previous,...latest,entries,isDefinitive:previous.isDefinitive||row.isDefinitive||entries.some(e=>e.reportType==='definitivo'||e.stage==='Resultado definitivo')});
 }
 if(records.size)merged.microResults=[...records.values()];return merged;
};

window.hc306SaveScale=(pid,tool,values,result)=>{
 if(!pid||pid!==String(selectedPatientId)||!findPatient(pid))throw Error('Seleccioná al paciente antes de guardar esta escala.');
 if(!['medico','enfermero','bioquimico','microbiologo','imagenologo','farmaceutico'].includes(session?.role))throw Error('Tu perfil puede calcular y copiar este resultado.');
 const {cl,cur}=hcEnsureClinicalPatient(pid),me=getCurrentUser(),at=isoNowLocalFull();
 const record={id:uid('scale'),scaleId:tool.id,title:tool.title,values:JSON.parse(JSON.stringify(values)),result:JSON.parse(JSON.stringify(result)),text:scaleText(tool,result,at),createdAt:at,updatedAt:at,createdBy:me.username,createdByName:me.name,institutionId:institution()};
 cur.calculatedScales=[...(cur.calculatedScales||[]),record];cl[pid]=cur;setClinical(cl);
 if(!scaleRecords(pid).some(x=>x.id===record.id))throw Error('No se pudo verificar el guardado. Conservá el resultado y reintentá.');
 window.hc224MarkClinicalFieldDirty?.(pid,'calculatedScales');hcBackendScheduleUrgentPush?.();logAction('guardó '+tool.title+' de '+buildPatientDisplayName(findPatient(pid)),pid);window.hc306RenderScaleHistory();notice('Escala guardada en la ficha del paciente.');return record;
};
window.hc306RenderScaleHistory=()=>{
 const root=q('#medScales');if(!root)return;let box=q('#hc306ScaleHistory');if(!box){box=document.createElement('section');box.id='hc306ScaleHistory';box.className='hc306ScaleHistory';root.append(box);}
 const rows=selectedPatientId?scaleRecords(selectedPatientId):[],html='<h3>Escalas guardadas de este paciente</h3>'+(!selectedPatientId?'<p>Seleccioná un paciente para guardar y consultar sus escalas.</p>':rows.length?rows.map(r=>'<article><b>'+esc(r.title)+'</b> · '+esc(dmyhmFromISODateTime(r.createdAt))+' · '+esc(r.createdByName||r.createdBy)+'<details><summary>Ver resultado guardado</summary><pre>'+esc(r.text)+'</pre></details></article>').join(''):'<p>Todavía no hay escalas guardadas. Calculá una y pulsá Guardar en este paciente.</p>');
 if(box.innerHTML!==html)box.innerHTML=html;
};
window.hc306ChooseScales=pid=>{
 const rows=scaleRecords(pid);if(!rows.length){notice('No hay escalas guardadas. Calculá y guardá una desde Escalas.');return;}
 const selected=new Set(window.__evoAttach?.scaleIds||[]);
 const {overlay,close}=dialog('Adjuntar escalas calculadas',rows.map(r=>'<label><input type="checkbox" value="'+esc(r.id)+'" '+(selected.has(r.id)?'checked':'')+'><span><b>'+esc(r.title)+'</b><small>'+esc(dmyhmFromISODateTime(r.createdAt))+' · '+esc(r.createdByName||r.createdBy)+(r.result?.score!==undefined?' · '+esc(r.result.score)+'/'+esc(r.result.max):'')+'</small></span></label>').join('')+'<footer><button type="button" class="btn" data-close>Cancelar</button><button type="button" class="btn primary" data-attach>Adjuntar selección</button></footer>');
 overlay.querySelector('[data-attach]').onclick=()=>{if(String(selectedPatientId)!==String(pid)){close();return;}const ids=[...overlay.querySelectorAll('input:checked')].map(x=>x.value);window.__evoAttach||={};window.__evoAttach.scaleIds=ids;window.__evoAttach.scales=rows.filter(r=>ids.includes(r.id)).map(r=>r.text).join('\n\n');updateAttachButtons();window.hc280PersistDrafts?.();close();};
};
const fields={sv:'attachSV',bal:'attachBAL',lab:'attachLAB',mic:'attachMIC',inv:'attachINV',rx:'attachRX',pr:'attachPR',scales:'attachSCALES'};
window.hc306AttachmentData=()=>Object.fromEntries(Object.entries(fields).map(([key,field])=>[field,window.__evoAttach?.[key]||'']));
window.hc306AttachmentText=data=>Object.entries(fields).map(([key,field])=>data?.[field]?'\n\n'+(key==='scales'?'ESCALAS CALCULADAS\n':'')+data[field]:'').join('');
const templateBase=buildPrettyEvoTemplate;buildPrettyEvoTemplate=function(data){return templateBase.apply(this,arguments)+(data.attachSCALES?'\n\nESCALAS CALCULADAS\n'+data.attachSCALES:'');};
const attachBase=updateAttachButtons;updateAttachButtons=function(){attachBase.apply(this,arguments);setAttachStatus('btnAttSCALES',!!window.__evoAttach?.scales);const summary=q('#hc306AttachSummary');if(summary)summary.textContent='Adjuntos: '+(Object.keys(fields).filter(k=>window.__evoAttach?.[k]).map(k=>({sv:'Signos vitales',bal:'Balances',lab:'Laboratorio',mic:'Microbiología',inv:'Invasiones',rx:'Imágenes',pr:'Prescripciones',scales:'Escalas calculadas'})[k]).join(', ')||'ninguno');};
function microVersions(pid){return (getMicroData(pid).cur.microResults||[]).filter(r=>r.entries?.length).flatMap(r=>r.entries.map((entry,index)=>({id:r.id+':'+index,title:buildMicroRequestItemsHTML(r.request||{}),entry,result:{...r,entries:r.entries.slice(0,index+1),isDefinitive:entry.reportType==='definitivo'||entry.stage==='Resultado definitivo',updatedAt:entry.at,updatedByName:entry.byName}})));}
window.hc306ChooseMicro=pid=>{
 const rows=microVersions(pid);if(!rows.length){notice('Todavía no hay informes microbiológicos en este paciente.');return;}
 const {overlay,close}=dialog('Informes de microbiología',rows.slice().reverse().map(r=>'<label><input type="checkbox" value="'+esc(r.id)+'"><span><b>'+esc(r.title)+'</b><small>'+esc(microResultStatusText(r.result))+' · '+esc(dmyhmFromISODateTime(r.entry.at))+'</small>'+esc(r.entry.growth||r.entry.note||'')+'</span><button type="button" class="btn small" data-print="'+esc(r.id)+'">Imprimir</button></label>').join('')+'<footer><button type="button" class="btn" data-close>Cancelar</button><button type="button" class="btn primary" data-attach>Adjuntar selección</button></footer>');
 overlay.querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.print);openPrintHTML('Informe '+microResultStatusText(r.result),buildInstHeaderHTML()+buildPatientHeaderHTMLForPrint(findPatient(pid))+'<pre class="pre">'+esc(buildMicroResultPretty(r.result))+'</pre>');});
 overlay.querySelector('[data-attach]').onclick=()=>{if(String(selectedPatientId)!==String(pid)){close();return;}const ids=[...overlay.querySelectorAll('input:checked')].map(x=>x.value);window.__evoAttach||={};window.__evoAttach.mic=rows.filter(r=>ids.includes(r.id)).map(r=>buildMicroResultPretty(r.result)).join('\n\n');updateAttachButtons();window.hc280PersistDrafts?.();close();};
};
const evoBase=evoRenderEditor;evoRenderEditor=window.evoRenderEditor=function(record){
 const value=evoBase.apply(this,arguments),pid=selectedPatientId;
 if(q('#btnAttMIC'))q('#btnAttMIC').onclick=()=>window.hc306ChooseMicro(pid);
 for(const id of ['btnEvoModePlantilla','btnEvoModeLibre']){const button=q('#'+id);if(!button)continue;const base=button.onclick;button.onclick=()=>{
  const attachments={...window.__evoAttach},controls=[...q('#evoEditorWrap').querySelectorAll('input,textarea,select')].map(e=>({id:e.id,value:e.value,checked:e.checked}));
  const k=String(pid)+'|'+String(q('#evoEditorWrap').dataset.hc280EditId||'');window.__hc306Modes||={};const cache=window.__hc306Modes[k]||={};
  for(const c of controls)if(c.id)cache[c.id]=c;
  base();for(const [id,c] of Object.entries(cache)){const el=document.getElementById(id);if(el){el.value=c.value;if(el.type==='checkbox'||el.type==='radio')el.checked=c.checked;}}
  window.__evoAttach=attachments;updateAttachButtons();
 };}
 return value;
};
window.hc306IsCurrentPrescription=it=>{
 if(!it||hcIsDeletedPrescriptionItem(it)||hcIsTerminalPrescriptionItem(it)||it.completedAt||it.endedAt)return false;
 const end=new Date(hcPrescriptionTreatmentEndAt(it)||'').getTime();return !(Number.isFinite(end)&&end<=Date.now()&&!hcIntermittentInfusionIsRunning(it));
};
const openRows=new Set();let rxSignature='',rxRoot=null,forceRx=false;
function compactRx(){
 q('#medPres')?.querySelectorAll('.prListItem').forEach(row=>{
  const controls=row.querySelector('.hcRxCompactControls,.hcRxMedicationControls');if(!controls)return;
  const buttons=[...controls.querySelectorAll('button[data-pr-action]')].filter(b=>!['dose-up','dose-down','nurse-ack','start-intermittent-infusion','finish-prepared-bag'].includes(b.dataset.prAction));if(!buttons.length)return;
  let edit=controls.querySelector('.hc306RxEdit');const key=String(selectedPatientId)+'|'+row.dataset.prItemId;
  if(!edit){edit=document.createElement('button');edit.type='button';edit.className='btn small hc306RxEdit';edit.textContent='✎';edit.title='Editar / ver acciones de la prescripción';edit.setAttribute('aria-label',edit.title);controls.append(edit);edit.onclick=()=>{openRows.has(key)?openRows.delete(key):openRows.add(key);compactRx();};}
  const expanded=openRows.has(key);edit.setAttribute('aria-expanded',String(expanded));buttons.forEach(b=>b.classList.toggle('hc306RxHidden',!expanded));
 });
}
const presBase=renderPrescripciones;
function signature(root){const cl=getClinical();return JSON.stringify([actor(),session?.role,selectedPatientId,q('#medAreaFilter')?.value,root.dataset,selectedPatientId?[cl[selectedPatientId],findPatient(selectedPatientId)]:[cl,getRegistry()],localStorage.getItem(LS.pharmacyDrugs),hcCurrentMedicationPlanDate()]);}
renderPrescripciones=window.renderPrescripciones=function(){
 const root=q('#medPres');if(!root)return;const next=signature(root);if(!forceRx&&rxRoot===root&&rxSignature===next&&root.childElementCount)return;
 const focus=document.activeElement,focusId=focus?.id,selection=focus?.selectionStart,scroll=root.scrollTop,y=scrollY;
 const value=presBase.apply(this,arguments);compactRx();rxRoot=root;rxSignature=signature(root);root.scrollTop=scroll;
 if(focusId&&root.contains(document.getElementById(focusId))){const current=document.getElementById(focusId);current?.focus({preventScroll:true});if(typeof selection==='number')try{current.setSelectionRange(selection,selection);}catch{}}
 if(scrollY!==y)scrollTo(0,y);return value;
};
let lastTasks='';window.hc306RefreshPrescriptions=()=>{
 if(document.hidden||window.hc280EditorActive?.()||hcBackendShouldProtectUIRefresh())return;
 const clock=q('#medPres .presDailyClock');if(clock)clock.textContent='Plan activo: '+hcCurrentMedicationPlanDate()+' (06 a 04 h) • Ahora: '+dmyhmFromISODateTime(isoNowLocalFull());
 const cl=getClinical(),items=selectedPatientId?cl[selectedPatientId]?.prescripciones?.infusionesContinuas||[]:Object.values(cl).flatMap(c=>c?.prescripciones?.infusionesContinuas||[]);
 const tasks=JSON.stringify([hcNursePrescriptionTasks(items),items.map(i=>[i.id,window.hc306IsCurrentPrescription(i)])]);forceRx=tasks!==lastTasks;lastTasks=tasks;try{renderPrescripciones();}finally{forceRx=false;}
};
const meals=[['Desayuno','08:00'],['Almuerzo','12:00'],['Merienda','16:00'],['Cena','20:00'],['Colaciones','']];
window.hc306NutritionMealsHTML=()=>'<fieldset class="hc306Meals"><legend>Programación por comidas</legend>'+meals.map(([name,time],i)=>'<div class="hc306Meal"><label><input type="checkbox" data-hc306-meal="'+i+'" '+(i<4?'checked':'')+'>'+name+'</label><input type="'+(i===4?'text':'time')+'" data-hc306-mealtime="'+i+'" value="'+time+'" placeholder="Ej.: 10:00 y 22:00" aria-label="Horario de '+name+'"><input data-hc306-mealdiet="'+i+'" aria-label="Dieta de '+name+'" placeholder="Dieta / contenido de '+name+'"></div>').join('')+'<p class="muted">Para vía oral, elegí las comidas. En nutrición por bomba podés desmarcarlas.</p></fieldset>';
window.hc306ReadNutritionMeals=root=>{
 const values=meals.flatMap(([name],i)=>root.querySelector('[data-hc306-meal="'+i+'"]')?.checked?[{name,time:root.querySelector('[data-hc306-mealtime="'+i+'"]')?.value||'',diet:root.querySelector('[data-hc306-mealdiet="'+i+'"]')?.value.trim()||''}]:[]);
 if(/oral/i.test(q('#nutType')?.value||'')&&!values.length){alert('Elegí al menos una comida para la dieta oral.');return null;}return values;
};
window.hc306NutritionMealsText=r=>r.meals?.length?'<div class="moduleMeta"><b>Comidas:</b> '+r.meals.map(m=>esc(m.name)+(m.time?' '+esc(m.time):'')+(m.diet?': '+esc(m.diet):'')).join(' · ')+'</div>':'';
const microBase=openMicroRequest;openMicroRequest=window.openMicroRequest=function(pid,req){const value=microBase.apply(this,arguments),stage=q('#microStage'),flag=q('#microDefFlag');if(stage&&flag){stage.previousElementSibling.textContent='Tipo de informe';flag.closest('.field').hidden=true;stage.onchange=()=>{flag.value=stage.value==='Resultado definitivo'?'si':'no';};stage.onchange();}return value;};
const renderMicroBase=renderMIC;renderMIC=window.renderMIC=function(){const value=renderMicroBase.apply(this,arguments);const root=q('#medMicro');if(root&&selectedPatientId&&!q('#hc306MicroReports')){const button=document.createElement('button');button.id='hc306MicroReports';button.type='button';button.className='btn';button.textContent='Ver / imprimir informes parciales y definitivos';const pid=selectedPatientId;button.onclick=()=>window.hc306ChooseMicro(pid);root.prepend(button);}return value;};
function updateHeaders(){
 const header=q('#hc306ClinicalHeader');if(!header)return;let parent=header.parentElement,inside=false;while(parent&&parent!==document.body){if(/auto|scroll/.test(getComputedStyle(parent).overflowY)){inside=true;break;}parent=parent.parentElement;}
 const top=q('.topbar'),height=inside?0:(top&&getComputedStyle(top).position==='sticky'?top.getBoundingClientRect().height:0),value=Math.round(height)+'px';if(header.style.getPropertyValue('--hc306-header-top')!==value)header.style.setProperty('--hc306-header-top',value);
}
new ResizeObserver(updateHeaders).observe(q('.topbar')||document.body);window.addEventListener('resize',updateHeaders);
let loop=0;setInterval(()=>{updateHeaders();const current=session?scope():'';if(current!==seenSession){seenSession=current;restored='';pending=null;}restoreRoute();if(medTab==='escalas')window.hc306RenderScaleHistory();if(++loop%10===0)remember();},1000);
setTimeout(()=>{restoreRoute();updateHeaders();compactRx();},200);
})();
