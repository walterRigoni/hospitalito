
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function({playwright,executablePath}){
const root=path.dirname(__dirname),site='https://walterrigoni.github.io/hospitalito/',checks=[],errors=[],signals=[];let serial=0,remaining=900,status='active';
const browser=await playwright.chromium.launch({executablePath,headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
 const contexts=await Promise.all([browser.newContext({viewport:{width:390,height:844},permissions:['camera','microphone'],serviceWorkers:'block'}),browser.newContext({viewport:{width:1280,height:800},permissions:['camera','microphone'],serviceWorkers:'block'})]);
 const pages=await Promise.all(contexts.map(c=>c.newPage()));
 const visit={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',mode:'telemedicine',starts_at:new Date(Date.now()-60000).toISOString(),ends_at:new Date(Date.now()+840000).toISOString(),status:'active',minutes:15};
 for(const page of pages){page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',async r=>{
  const url=r.request().url();if(url===site)return r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'),'utf8')});
  let b={};try{b=r.request().postDataJSON()||{}}catch{}
  let out={ok:true,institutions:[],providers:[],rows:[],members:[],notifications:[],bookings:[],orders:[],results:[],admissions:[]},side=b.token==='TEST-PRO'?'provider':'client';
  if(url.includes('supabase.co')){
   if(b.action==='me')out={...out,client:{username:'test-client',legal_name:'PACIENTE FICTICIO',profile:{}},verifications:[]};
   if(url.includes('hospitalito-telemed')){
    if(b.action==='join')out={ok:true,side,rtcConfig:{iceServers:[],relayConfigured:true},clock:{status:'confirmed',remaining,connected:false,entitledSeconds:900}};
    if(b.action==='signal'){signals.push({id:++serial,sender:side,kind:b.kind,payload:b.payload});}
    if(b.action==='signals')out={ok:true,signals:signals.filter(s=>s.id>b.cursor&&s.sender!==side)};
    if(b.action==='heartbeat')out={ok:true,clock:{status,remaining,connected:true,entitledSeconds:900}};
    if(b.action==='visit')out={ok:true,visit:{...visit,status},side,role:side==='provider'?'medico':'cliente',payments:[],peerName:'PERSONA FICTICIA',patient:side==='provider'?{legal_name:'PACIENTE FICTICIO',dni:'99999991',profile:{}}:null};
    if(b.action==='documents')out={ok:true,documents:[]};
    if(b.action==='finish')status='finished';
   }
   return r.fulfill({contentType:'application/json',body:JSON.stringify(out)});
  }
  return r.fulfill({status:404,body:''});
 });await page.goto(site);}
 await pages[0].evaluate(()=>window.hc289EnterClient({token:'TEST-CLIENT',user:{username:'test-client',name:'PACIENTE FICTICIO',role:'cliente'}}));
 await pages[1].evaluate(()=>{session={username:'test-pro',role:'medico',name:'PROFESIONAL FICTICIO'};localStorage.setItem(LS.globalAuthToken,'TEST-PRO');});
 await Promise.all(pages.map(p=>p.evaluate(id=>window.hc292OpenVideo(id),visit.id)));
 await Promise.all(pages.map(p=>p.waitForFunction(()=>{const v=document.querySelector('.hc292Video [data-remote]');return v?.srcObject?.getAudioTracks().length&&v.srcObject.getVideoTracks().length},{timeout:30000})));
 checks.push('Two isolated participants exchange real simulated audio and video over WebRTC');
 await pages[0].locator('[data-mic]').click();
 assert(await pages[0].evaluate(()=>document.querySelector('[data-local]').srcObject.getAudioTracks().every(t=>!t.enabled)));
 checks.push('Microphone control mutes the outgoing track');
 await pages[0].locator('[data-camera]').click();
 assert(await pages[0].evaluate(()=>document.querySelector('[data-local]').srcObject.getVideoTracks().every(t=>!t.enabled)));
 checks.push('Camera control disables the outgoing track');
 await pages[0].locator('[data-reconnect]').click();
 await pages[0].waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('establecida'),{timeout:20000});
 checks.push('Client reconnect negotiates a new session');
 remaining=0;await Promise.all(pages.map(p=>p.waitForFunction(()=>document.querySelector('.hc292Video')?.dataset.paymentPaused==='true',{timeout:12000})));
 assert(await pages[0].evaluate(()=>document.querySelector('[data-local]').srcObject.getTracks().every(t=>!t.enabled)));
 checks.push('Exhausted server entitlement pauses audio and video');
 assert(await pages[0].locator('[data-extension]').isVisible());checks.push('Continuation prompt is shown without any automatic charge');
 for(const width of [320,390,768]){await pages[0].setViewportSize({width,height:844});assert(await pages[0].locator('.hc292Video').evaluate(e=>e.scrollWidth<=e.clientWidth+2));}checks.push('Video room fits 320/390/768 pixel widths');
 await pages[0].evaluate(()=>window.__testTracks=[...document.querySelector('[data-local]').srcObject.getTracks()]);
 await pages[0].locator('.hc292Video [data-close]').click();
 assert(await pages[0].evaluate(()=>__testTracks.every(t=>t.readyState==='ended')));checks.push('Leaving the room stops all camera and microphone tracks');
 status='finished';await pages[1].locator('.hc292Video').waitFor({state:'detached',timeout:12000});checks.push('Other participant sees server finalization and releases the room');
 assert.equal(errors.length,0,errors.join('; '));checks.push('No uncaught browser errors');
 return {checks,realCamerasUsed:0,productionRequests:0};
}finally{await browser.close();}
};
