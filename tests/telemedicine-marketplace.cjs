const fs292=require('node:fs/promises'),path=require('node:path');const root292=path.dirname(__dirname);module.exports=async function({playwright,executablePath}){

var errors292=[],requests292=[];
var browser292=await playwright.chromium.launch({executablePath,headless:true});try{var context292=await browser292.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
var page292=await context292.newPage();page292.on('pageerror',e=>errors292.push(e.message));
var weeklyFixture292={days:Object.fromEntries(Array.from({length:7},(_,n)=>[n,{active:true,start:'08:00',end:'20:00'}]))};
var profileFixture292={username:'test-v292-pro',name:'PROFESIONAL FICTICIO',role:'medico',specialty:'Cardiología',credential:'MATRÍCULA FICTICIA',description:'Perfil de prueba',address:'CONSULTORIO FICTICIO',revision:1,public_visible:true,paymentsConnected:true,modes:{telemedicine:{enabled:true,weekly:weeklyFixture292,rates:[{minutes:15,amount_cents:1000000},{minutes:30,amount_cents:1800000}]},office:{enabled:true,weekly:weeklyFixture292,rates:[{minutes:15,amount_cents:1000000},{minutes:30,amount_cents:1800000}]}}};
var visitFixture292={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',provider:'test-v292-pro',client:'test-v292-client',mode:'office',starts_at:new Date(Date.now()+3600000).toISOString(),ends_at:new Date(Date.now()+5400000).toISOString(),minutes:30,total_cents:1800000,platform_cents:360000,provider_cents:1440000,status:'awaiting_payment',hold_until:new Date(Date.now()+600000).toISOString()};
await page292.route('**/*',async route=>{const url=route.request().url();if(url==='https://walterrigoni.github.io/hospitalito/')return route.fulfill({contentType:'text/html',body:await fs292.readFile(root292+'/index.html','utf8')});let body={};try{body=route.request().postDataJSON()||{}}catch{}if(url.includes('supabase.co')){requests292.push({url,body});let out={ok:true,rows:[],institutions:[],providers:[],members:[],notifications:[],bookings:[],orders:[],results:[],admissions:[]};if(body.action==='me')out={...out,client:{username:'test-v292-client',legal_name:'PACIENTE FICTICIO',dni:'99999991',dob:'1990-01-01',profile:{}},verifications:[]};if(url.includes('hospitalito-telemed')){if(body.action==='directory')out={ok:true,providers:[profileFixture292],paymentsReady:true,commissionBps:2000,cancellationPolicy:'CONDICIONES FICTICIAS'};if(body.action==='slots')out={ok:true,profileRevision:1,slots:[{start:new Date(Date.now()+3600000).toISOString(),local:'2026-11-18T10:00',available:true},{start:new Date(Date.now()+5400000).toISOString(),local:'2026-11-18T10:30',available:false}]};if(body.action==='reserve')out={ok:true,visit:visitFixture292};if(body.action==='visit')out={ok:true,visit:visitFixture292,side:'client',role:'cliente',peerName:'PROFESIONAL FICTICIO',payments:[{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',kind:'initial',minutes:30,amount_cents:360000,status:'offered',expires_at:new Date(Date.now()+600000).toISOString()}]};if(body.action==='documents')out={ok:true,documents:[]};if(body.action==='myProfile')out={ok:true,role:'medico',profile:profileFixture292,paymentsConnected:false,oauthReady:false};if(body.action==='saveProfile')out={ok:true,profile:{...body.profile,revision:2}};if(body.action==='myVisits')out={ok:true,visits:[]};}return route.fulfill({contentType:'application/json',body:JSON.stringify(out)});}return route.fulfill({status:404,body:''});});
await page292.goto('https://walterrigoni.github.io/hospitalito/');
await page292.evaluate(()=>window.hc289EnterClient({token:'FAKE-TEST-TOKEN',user:{username:'test-v292-client',name:'PACIENTE FICTICIO',role:'cliente'}}));
await page292.evaluate(()=>window.hc292Search());
await page292.locator('[data-tele-profile]').waitFor();
var checks292=[];function check292(v,label){if(!v)throw Error(label);checks292.push(label)}
check292(await page292.locator('#hc292SearchForm [name=specialty] option').count()>60,'Medical dropdown contains the specialty catalog without published providers for every specialty');
await page292.locator('#hc292SearchForm [name=specialty]').selectOption({label:'Cardiología'});
check292(await page292.locator('[data-tele-profile]').count()===1,'Specialty filter keeps matching professional');
await page292.locator('#hc292SearchForm [name=role]').selectOption('kinesiologo');
check292(await page292.locator('[data-tele-profile]').count()===0,'Role filter excludes physicians from kinesiology');
check292(await page292.locator('#hc292SearchForm [name=specialty] option').count()>5,'Specialty dropdown adapts to professional role');
await page292.locator('#hc292SearchForm [name=role]').selectOption('medico');
await page292.locator('#hc292SearchForm [name=mode]').selectOption('office');
await page292.locator('[data-tele-profile]').click();
await page292.locator('#hc292Slots button').first().waitFor();
check292(await page292.locator('#hc292Slots button:disabled').count()===1,'Busy slot is not selectable');
await page292.locator('#hc292Plan').selectOption('30');
await page292.waitForFunction(()=>document.querySelector('#hc292PaymentSummary').textContent.includes('3.600'));
check292((await page292.locator('#hc292PaymentSummary').innerText()).includes('14.400'),'Office view separates deposit and balance due after attendance');
await page292.locator('#hc292Slots button:enabled').first().click();
check292(await page292.locator('#hc292Reserve').isDisabled(),'Reservation requires explicit terms acceptance');
await page292.locator('#hc292Accept').check();
check292(await page292.locator('#hc292Reserve').isEnabled(),'Chosen slot and accepted quote enables reservation');
await page292.locator('#hc292Reserve').click();
await page292.locator('[data-tele-pay]').waitFor();
check292(requests292.filter(x=>x.body.action==='reserve').length===1,'One reservation request after patient confirmation');
check292(!requests292.some(x=>x.body.action==='checkout'),'No checkout before accepting the actual deposit');
await page292.locator('[data-292-close]').click();
await page292.evaluate(()=>window.hc292Search());await page292.locator('#hc292InstitutionSearch').click();
check292(await page292.locator('select#hc289Specialty').count()===1,'Institutional search also uses a real dropdown');
await page292.evaluate(()=>{window.hc289ClientSession=null;session={username:'test-v292-pro',name:'PROFESIONAL FICTICIO',role:'medico'};});
await page292.evaluate(()=>window.hc292Professional());
await page292.locator('#hc292ProfileForm form').waitFor();
check292(await page292.locator('[data-mode] [data-day]').count()===14,'Separate weekly availability for telemedicine and office');
check292(await page292.locator('[data-rate]').count()===8,'Separate 15/30/45/60 minute prices for each mode');
await page292.locator('#hc292ProfileForm [name=consent]').check();
await page292.locator('#hc292ProfileForm button[type=submit]').click();
await page292.waitForFunction(()=>document.querySelector('#hc292ProfileStatus').textContent.includes('guardados'));
check292(requests292.some(x=>x.body.action==='saveProfile'&&x.body.profile.modes.telemedicine.rates.find(r=>r.minutes===30).amount_cents===1800000),'Profile save uses integer cents and weekly schedules');
check292(errors292.length===0,'No uncaught browser errors: '+errors292.join('; '));
return {checks:checks292,errors:errors292,productionRequests:0};}finally{await browser292.close();}

};
