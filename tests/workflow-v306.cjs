
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
let scripts=0;for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){if(m[1].trim()){new vm.Script(m[1]);scripts++;}}
const expectedVersion = 'v' + html.match(/const CURRENT_VERSION = (\d+);/)[1];
const expectedScripts = {v306:58, v307:59, v308:60, v309:61,v310:62,v311:63,v312:63,v313:64}[expectedVersion];
assert(html.includes('id="hc-v306-ui"'));assert.equal(scripts,expectedScripts);
function fn(name){const start=html.indexOf('function '+name+'(');assert(start>=0,name);let depth=0,open=html.indexOf('{',start);for(let i=open;i<html.length;i++){if(html[i]==='{')depth++;if(html[i]==='}'&&!--depth)return html.slice(start,i+1);}throw Error(name);}
const now=Date.parse('2026-11-21T02:00:00-03:00');class FakeDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
let rows=[{id:'workshift:inst:user:2026-11-20',kind:'work_shift',user:'user',institutionDataId:'inst',dateLocal:'2026-11-20',startDate:'2026-11-20',startTime:'20:00',endDate:'2026-11-21',endTime:'08:00',updatedAt:'2026-11-20T20:00:00'}];
const storage=new Map(),ctx=vm.createContext({Date:FakeDate,Map,JSON,Number,activity:()=>rows,userName:()=> 'user',dataInstitution:()=> 'inst',localDate:()=> '2026-11-21',shiftId:()=> 'workshift:inst:user:2026-11-21',localStorage:{getItem:key=>storage.get(key)||null}});
vm.runInContext(fn('todayShift'),ctx);assert.equal(vm.runInContext('todayShift().id',ctx),rows[0].id);
storage.set('hc306.shift.inst.user',JSON.stringify(rows[0]));rows=[];assert.equal(vm.runInContext('todayShift().endTime',ctx),'08:00');
ctx.dataInstitution=()=> 'other';assert.equal(vm.runInContext('todayShift()',ctx),null);

const ui=fs.readFileSync(path.join(__dirname,'../ui/v306.js'),'utf8'),mergeStart=ui.indexOf('const clinicalMergeBase='),mergeEnd=ui.indexOf('window.hc306SaveScale=',mergeStart);
const mergeContext=vm.createContext({window:{},hcMergeClinicalPatientRecord:(a,b)=>({...a,...b})});vm.runInContext(ui.slice(mergeStart,mergeEnd),mergeContext);
const culture={id:'culture',updatedAt:'2026-11-20T12:00:00',entries:[]},partial={...culture,entries:[{id:'partial',at:culture.updatedAt,stage:'Resultado parcial'}]},definitive={...culture,isDefinitive:true,entries:[{id:'final',at:culture.updatedAt,stage:'Resultado definitivo'}]};
assert.equal(mergeContext.hcMergeClinicalPatientRecord({microResults:[culture]},{microResults:[partial]}).microResults[0].entries.length,1);
const both=mergeContext.hcMergeClinicalPatientRecord({microResults:[partial]},{microResults:[definitive]}).microResults[0];assert.equal(both.entries.length,2);assert(both.isDefinitive);
console.log('PASS '+scripts+' scripts; overnight shifts, institution isolation and concurrent same-second culture reports');

if(process.env.HC306_BROWSER!=='1')process.exit(0);
const {chromium}=require('playwright'),http=require('node:http');
(async()=>{
 const server=http.createServer((req,res)=>{try{const name=req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0].slice(1);res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(path.join(__dirname,'..',name)));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{throw new Error('Unexpected dialog: '+d.message());});
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"Offline integration test"}'}));
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
 await page.waitForTimeout(1500);
 const checks=await page.evaluate(async(expectedVersion)=>{
  const results=[];function ok(name,value){if(!value)throw Error(name+'; completed: '+results.join(', '));results.push(name);}
  localStorage.clear();
  session={username:'test306',name:'Profesional de prueba',role:'medico',institutionId:'test306'};
  saveJSON(LS.session,session);
  getCurrentUser=()=>({id:'doctor306',username:'test306',name:'Profesional de prueba',role:session?.role||'medico',active:true});
  saveJSON(LS.users,[getCurrentUser()]);
  saveJSON(LS.patients,[{id:'p306',dni:'00000001',lastName:'Paciente',firstNames:'Prueba'}]);
  saveJSON(LS.registry,[{id:'adm306',patientId:'p306',active:true,bedId:'UTI-1',admDateTime:isoNowLocalFull()}]);
  hcBackendConfigured=()=>false;hc270CheckScope=()=>{};hcBackendScheduleUrgentPush=()=>{};hcBackendMarkLocalSavedSoon=()=>{};
  selectedPatientId='p306';medTab='evolucion';window.hc306RestoreRoute();showAppByRole('medico');renderMed();
  document.querySelector('#hc229ShiftModal')?.classList.remove('show');
  ok('version',window.HC_DEMO_VERSION===expectedVersion);ok('patient',!!findPatient('p306'));
  const api=window.HospitalitoScales,tool=api.list().find(t=>t.id==='qsofa'),values={rr:22,sbp:100,mental:1},result=api.calculate('qsofa',values),record=window.hc306SaveScale('p306',tool,values,result);
  ok('saved scale',getClinical().p306.calculatedScales[0].result.score===3);
  const merged=hcMergeClinicalPatientRecord({calculatedScales:[record]},{calculatedScales:[{...record,id:'second-scale'}]});ok('concurrent scale merge',merged.calculatedScales.length===2);
  evoUIState='new';evoRenderEditor({kind:'libre',data:{}});evoSetState('new');
  ok('free text attachments',!!document.querySelector('#btnAttSV')&&!!document.querySelector('#btnAttSCALES')&&getComputedStyle(document.querySelector('#hc306EvoAttachments')).display!=='none');
  document.querySelector('#evo_free').value='Evolución de prueba.';window.__evoAttach.sv='Signos vitales de prueba';window.__evoAttach.scales=record.text;document.querySelector('#btnSaveEvoFree').click();
  const evo=getClinical().p306.evolucionesFull.at(-1);ok('free text save',evo.prettyText.includes('Signos vitales de prueba')&&evo.data.attachSCALES===record.text);
  medTab='nutricion';renderMed();ok('five meals',document.querySelectorAll('[data-hc306-meal]').length===5);
  document.querySelector('[data-hc306-mealdiet="0"]').value='Hiposódica';document.querySelector('#nutReqTiming').value='urgent';document.querySelector('#btnSaveNutReq').click();
  const nut=getClinical().p306.nutritionRequests.at(-1);ok('meals persisted',nut.meals.length===4);ok('meal prescription',getClinical().p306.prescripciones.infusionesContinuas.some(r=>String(r.text||r.freeText||r.preparationText).includes('Desayuno')));
  const latest=hcEnsureClinicalPatient('p306');latest.cur.microRequests=[{id:'micro306',createdAt:isoNowLocalFull(),items:[{name:'Hemocultivo',detail:'Prueba'}]}];latest.cl.p306=latest.cur;setClinical(latest.cl);
  session.role='microbiologo';medTab='micro';renderMed();openMicroRequest('p306','micro306');document.querySelector('#microStage').value='Resultado parcial';document.querySelector('#microStage').dispatchEvent(new Event('change'));document.querySelector('#microGrowth').value='Colonias en crecimiento';document.querySelector('#btnSendLab').click();
  let micro=getClinical().p306.microResults[0];ok('partial report',!micro.isDefinitive&&micro.entries[0].reportType==='parcial');
  openMicroRequest('p306','micro306');document.querySelector('#microStage').value='Resultado definitivo';document.querySelector('#microStage').dispatchEvent(new Event('change'));document.querySelector('#microGrowth').value='Crecimiento identificado';document.querySelector('#btnSendLab').click();micro=getClinical().p306.microResults[0];ok('definitive report',micro.isDefinitive&&micro.entries.length===2);
  ok('print status',buildMicroResultPretty(micro).includes('DEFINITIVO'));
  session.role='medico';const rx=hcEnsureClinicalPatient('p306');rx.cur.prescripciones.infusionesContinuas.push({id:'inf306',drugId:'noradrenalina',drugName:'Noradrenalina',type:'infusion_continua',via:'EV',regularidad:'continua',active:true,rateMlH:10,mlHour:10,volumeMl:100,totalAmount:4,totalAmountUnit:'mg',weightKg:70,startedAt:isoNowLocalFull(),createdAt:isoNowLocalFull()});rx.cl.p306=rx.cur;setClinical(rx.cl);medTab='prescripciones';renderMed();const first=document.querySelector('#medPres').firstElementChild;renderPrescripciones();ok('stable DOM',first===document.querySelector('#medPres').firstElementChild);
  const infusion=document.querySelector('[data-pr-item-id="inf306"]');ok('infusion rate arrows',!!infusion?.querySelector('[data-pr-action="dose-up"]')&&!!infusion?.querySelector('[data-pr-action="dose-down"]'));
  const pencil=infusion.querySelector('.hc306RxEdit'),pause=infusion.querySelector('.hcRxCompactControls [data-pr-action="pause"]');ok('compact actions',!!pencil&&getComputedStyle(pause).display==='none');pencil.click();ok('pencil opens actions',getComputedStyle(pause).display!=='none');pencil.click();
  ok('current order filter',window.hc306IsCurrentPrescription({id:'a',active:true})&&!window.hc306IsCurrentPrescription({id:'b',suspendedAt:isoNowLocalFull()})&&!window.hc306IsCurrentPrescription({id:'c',finishedAt:isoNowLocalFull()}));
  window.hc306RememberRoute();const route=JSON.parse(localStorage.getItem('hc306.route.test306|test306'));ok('route persisted',route.patient==='p306'&&route.tab==='prescripciones');
  const savedSession={...session};session=null;await new Promise(resolve=>setTimeout(resolve,1100));session=savedSession;selectedPatientId=null;medTab='ingreso';await new Promise(resolve=>setTimeout(resolve,1100));ok('route restored after session reactivation',selectedPatientId==='p306'&&medTab==='prescripciones');
  ok('sticky group',document.querySelectorAll('#hc306ClinicalHeader > #instHdrBar,#hc306ClinicalHeader > #pacHdrBar,#hc306ClinicalHeader > .medModuleTabs').length===3);
  ok('default persistent session',window.hc280Access.idleMinutes()===0);
  window.hc306ChooseMicro('p306');ok('report version selector',document.querySelectorAll('.hc306Dialog input[type=checkbox]').length===2);document.querySelector('.hc306Dialog [data-close]').click();
  localStorage.setItem('hc289.visual.test306',JSON.stringify({color:'default',mode:'light',font:'default'}));window.hc289ApplyVisual();
  const diet=document.querySelector('.freeTextRxItem .freeTextRxText'),dietColor=getComputedStyle(diet).color,dietSurface=getComputedStyle(diet).backgroundColor;
  ok('light prescription text',dietColor==='rgb(21, 33, 44)'&&dietSurface==='rgb(255, 255, 255)');ok('light diet title',getComputedStyle(document.querySelector('.hc275NutritionTitle')).color==='rgb(7, 81, 120)');
  if(['v307','v308','v309','v310'].includes(expectedVersion)){
   ok('visible version',document.querySelector('#hc307Version')?.textContent===expectedVersion);
   const fixture=hcEnsureClinicalPatient('p306'),base=fixture.cur.prescripciones.infusionesContinuas.find(i=>i.id==='inf306');
   fixture.cur.prescripciones.infusionesContinuas.push(...[
    {id:'paused307',active:false},
    {id:'rbc307',hemotherapyProduct:'rbc',drugId:'hemotherapy_rbc',drugName:'Glóbulos rojos'},
    {id:'plasma307',hemotherapyProduct:'plasma',drugId:'hemotherapy_plasma',drugName:'Plasma'},
    {id:'rbcPaused307',active:false,hemotherapyProduct:'rbc',drugId:'hemotherapy_rbc',drugName:'Glóbulos rojos en pausa'},
    {id:'plasmaPaused307',active:false,hemotherapyProduct:'plasma',drugId:'hemotherapy_plasma',drugName:'Plasma en pausa'}
   ].map(change=>({...base,...change})));
   const day=isoNowLocalFull().slice(0,10);fixture.cur.balances=[
    {id:'bal307a',dateTime:day+'T08:00',ingresos:1000,egresos:200,user:'Enfermería de prueba'},
    {id:'bal307b',dateTime:day+'T10:00',ingresos:300,egresos:150,user:'Enfermería de prueba'}
   ];fixture.cl.p306=fixture.cur;setClinical(fixture.cl);renderPrescripciones();
   for(const [id,color] of [['inf306','rgb(34, 197, 94)'],['paused307','rgb(125, 211, 252)'],['rbc307','rgb(239, 68, 68)'],['plasma307','rgb(250, 204, 21)'],['rbcPaused307','rgb(125, 211, 252)'],['plasmaPaused307','rgb(125, 211, 252)']]){
    const dot=document.querySelector('[data-pr-item-id="'+id+'"] .hcInfusionFlowDot');
    ok('flow color '+id,!!dot&&getComputedStyle(dot).backgroundColor===color);
   }
   const row=document.querySelector('[data-pr-item-id="inf306"]'),style=document.querySelector('#hc-v307-styles');
   const compact=row.getBoundingClientRect().height;style.disabled=true;const previous=row.getBoundingClientRect().height;style.disabled=false;
   ok('shorter prescription row',compact<previous);
   medTab='bal';renderMed();const wrap=document.querySelector('.hc307BalanceScroll');
   ok('balance cumulative preserved',wrap.querySelector('tbody tr:nth-child(2) td:nth-child(6)').textContent.trim()==='+950 ml');
   ok('balance keyboard focus',wrap.tabIndex===0&&wrap.getAttribute('role')==='region');
   medTab='prescripciones';renderMed();
  }
  return results;
 },expectedVersion);
 console.log('PASS browser:',checks.join(', '));console.log('page errors:',JSON.stringify(errors));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
 const layout=await page.evaluate(()=>{document.body.classList.add('hcMobile');const h=document.querySelector('#hc306ClinicalHeader');return {sticky:getComputedStyle(h).position,width:document.documentElement.scrollWidth,viewport:innerWidth,light:document.body.dataset.hc289Mode,logoutVisible:document.querySelector('#btnLogout').getClientRects().length>0};});
 assert.equal(layout.sticky,'sticky');assert.equal(layout.logoutVisible,false);assert.equal(layout.light,'light');assert(layout.width<=layout.viewport+2,JSON.stringify(layout));console.log('PASS mobile layout',layout);
 await page.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='2000px';spacer.id='hc306StickyTest';document.querySelector('#medPanel').append(spacer);window.scrollTo(0,450);});
 await page.waitForTimeout(1100);
 const sticky=await page.evaluate(()=>({top:document.querySelector('#hc306ClinicalHeader').getBoundingClientRect().top,bar:document.querySelector('.topbar').getBoundingClientRect().bottom,scroll:scrollY}));
 assert(sticky.scroll>100&&Math.abs(sticky.top-sticky.bar)<4,JSON.stringify(sticky));console.log('PASS headers remain visible while scrolling',sticky);
 await page.evaluate(()=>window.scrollTo(0,0));
 if(['v307','v308','v309','v310'].includes(expectedVersion)){
  for(const width of [320,390,844,1280]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(()=>{medTab='bal';renderMed();});
   const balance=await page.evaluate(()=>{const wrap=document.querySelector('.hc307BalanceScroll');wrap.scrollLeft=wrap.scrollWidth;const last=wrap.querySelector('th:last-child').getBoundingClientRect(),bounds=wrap.getBoundingClientRect();return {page:document.documentElement.scrollWidth,viewport:innerWidth,scroll:wrap.scrollLeft,overflow:wrap.scrollWidth>wrap.clientWidth,lastVisible:last.right<=bounds.right+2};});
   assert(balance.page<=width+2&&balance.lastVisible,JSON.stringify({width,...balance}));
   if(width<=390)assert(balance.overflow&&balance.scroll>0,JSON.stringify(balance));
   console.log('PASS balance all columns accessible',width,balance);
  }
  await page.evaluate(()=>{medTab='prescripciones';renderMed();});await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await page.evaluate(()=>{const dot=document.querySelector('[data-pr-item-id="inf306"] .hcInfusionFlowDot'),s=getComputedStyle(dot);return {color:s.backgroundColor,animation:s.animationName};});
  assert.equal(reduced.color,'rgb(34, 197, 94)');assert.equal(reduced.animation,'none');
  assert.deepEqual(errors,[]);console.log('PASS reduced motion retains visible active color; zero page errors');
 }
 if(process.env.HC306_SCREENSHOT)await page.screenshot({path:process.env.HC306_SCREENSHOT});
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
