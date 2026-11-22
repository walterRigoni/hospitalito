const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.equal(html, fs.readFileSync(path.join(root, 'Hospitalito_v'+html.match(/CURRENT_VERSION = (\d+);/)[1]+'.html'), 'utf8'));
const site = 'https://walterrigoni.github.io/hospitalito/';
const screenshotDir = process.env.HC_VISUAL_DIR;
const date = new Date();
const argentina = new Intl.DateTimeFormat('fr-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'});
const today=argentina.format(date);
const provider = {id:'qa',role:'medico',name:'Profesional de prueba',institution_id:'inst',specialty:'Cardiología',private_practice:false};
async function capture(page,name) {
  if (!screenshotDir) return;
  fs.mkdirSync(screenshotDir,{recursive:true});
  await page.screenshot({path:path.join(screenshotDir,name+'.png'), animations:'disabled'});
}
async function contrast(locator){
  const ratio=await locator.evaluate(el=>{
    const rgb=value=>{
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];
    };
    const lum=c=>c.slice(0,3).map(v=>v/255).map(n=>n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4).reduce((v,n,i)=>v+n*[0.2126,0.7152,0.0722][i],0);
    let node=el,background=[255,255,255,255];
    while(node){const c=rgb(getComputedStyle(node).backgroundColor);if(c[3]===255){background=c;break;}node=node.parentElement;}
    const values=[lum(rgb(getComputedStyle(el).color)),lum(background)].sort((a,b)=>b-a);
    return (values[0]+0.05)/(values[1]+0.05);
  });
  assert(ratio>=4.5,'Insufficient contrast: '+ratio.toFixed(2));
}
async function run() {
  const browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined});
  try {
    for (const width of [390,320,1280]) {
      const context = await browser.newContext({viewport:{width,height:844},hasTouch:width<800,isMobile:width<800,serviceWorkers:'block'});
      const page = await context.newPage(), errors=[],bookings=[],visits=[],reserveRequests=[];
      let failDirectory=true,changedQuote=true,resolveNote;
      const prior={id:'consulta-anterior',mode:'office',status:'finished',starts_at:new Date(date.getTime()-86400000).toISOString(),minutes:30,is_trial:true,peer_name:'Persona anterior'};
      const upcoming={...prior,id:'consulta-proxima',status:'confirmed',starts_at:new Date(today+'T23:59:00-03:00').toISOString(),peer_name:'Persona próxima'};
      const next = new Date(today+'T23:59:00-03:00');
      const nextDay=today;
      page.setDefaultTimeout(8000);
      page.on('pageerror',error=>{errors.push(error.message);console.error('Error de interfaz:',error.stack);});
      await page.route('**/*',async route=>{
        if(route.request().url()===site) return route.fulfill({contentType:'text/html',body:html});
        const b=route.request().postDataJSON()||{};
        const responses={
          publicBranding:{settings:{programName:'Hospitalito'}},
          directory:{providers:[provider],institutions:[{id:'inst',name:'Centro de prueba'}]},
          me:{client:{username:'test',profile:{}},verifications:[{institution_id:'inst',status:'verified'}]},
          calendar:{days:[{date:today,free:1,total:1,slots:[{local:today+'T22:00',available:true}]}]},
          calendarVisits:{visits:[upcoming]},
          myReports:{reports:[{id:'r1',visit_id:'visita-de-prueba',name:'Informe de prueba'}]},
          myIdentityDocuments:{documents:[]},
          myProfile:{role:'medico',professionalPhoto:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',profile:null},
          myVisits:{visits}, clientData:{admissions:[],results:[],orders:[],bookings}
        };
        if (route.request().url().includes('hospitalito-telemed')) {
          const office={enabled:true,rates:[{minutes:15,amount_cents:100000},{minutes:30,amount_cents:180000}],weekly:{days:Array.from({length:7},()=>({active:true}))}};
          if(b.action==='directory' && failDirectory) {failDirectory=false;return route.fulfill({status:503,json:{ok:false,error:'Conexión de prueba interrumpida'}});}
          if(b.action==='directory')return route.fulfill({json:{ok:true,providers:[{...provider,username:'qa',revision:1,trialAvailable:true,modes:{office,telemedicine:office,home:office}}]}});
          if(b.action==='availability')return route.fulfill({json:{ok:true,providers:[{id:'qa',available:true}]}});
          if(b.action==='slots'){
            const profileRevision=changedQuote?2:1;
            changedQuote=false;
            return route.fulfill({json:{ok:true,profileRevision,slots:[{start:b.date+'T12:00:00Z',local:b.date+'T09:00',available:true,address:'Calle de prueba 100',location:'Consultorio',latitude:-31.4,longitude:-64.2}]}});
          }
          if(b.action==='reserve'){
            reserveRequests.push(b);
            const visit={id:'visita-de-prueba',mode:b.mode,client:'test',status:'confirmed',location_snapshot:b.homeAddress||'',starts_at:next.toISOString(),minutes:b.minutes,is_trial:true,total_cents:0,peer_name:provider.name};
            visits.push(visit);
            return route.fulfill({json:{ok:true,visit}});
          }
          if(b.action==='myVisits'&&!b.token)return route.fulfill({json:{ok:true,visits:[prior,upcoming]}});
          if(b.action==='notifications'&&!b.token)return route.fulfill({json:{ok:true,notifications:[{
            id:'aviso-ficticio',kind:'tele_booking',title:'Nueva solicitud de turno',body:'Atención a Domicilio',
            payload:{visitId:'aviso-domicilio',mode:'home'}
          }]}});
          if(b.action==='visit'&&b.visitId==='aviso-domicilio')return route.fulfill({json:{ok:true,side:'provider',visit:{...upcoming,mode:'home'},peerName:'Paciente de domicilio'}});
          if(b.action==='clinicalRecord')return route.fulfill({json:{ok:true,note:null,history:[]}});
          if(b.action==='saveClinicalRecord'){
            await new Promise(resolve=>{resolveNote=resolve;});
            return route.fulfill({json:{ok:true,note:{revision:1}}});
          }
          if(b.action==='visit'&&!b.token)return route.fulfill({json:{ok:true,side:'provider',visit:upcoming,peerName:upcoming.peer_name}});
          if(b.action==='visit')return route.fulfill({json:{ok:true,visit:visits.find(v=>v.id===b.visitId),side:'client',peerName:provider.name,payments:[]}});
          if(b.action==='documents')return route.fulfill({json:{ok:true,documents:[]}});
          if(b.action==='saveProfile')return route.fulfill({json:{ok:true,profile:{...b.profile,revision:1}}});
        }
        return route.fulfill({json:{ok:true,...responses[b.action]}});
      });
      await page.goto(site);
      await page.waitForSelector('#hc289RegisterLink');
      assert.equal(await page.locator('#loginWrap > .card #hc280DeviceLogin').count(),1);
      assert.equal(await page.locator('#hc307Version').innerText(),'v'+html.match(/CURRENT_VERSION = (\d+);/)[1]);
      assert.equal(await page.getByLabel('Contraseña',{exact:true}).count(),1);
      await capture(page,'ingreso-'+width);
      await page.evaluate(()=>{
        session={username:'qa308',role:'medico',institutionId:'inst',name:'Profesional de prueba'};
        getCurrentUser=()=>({id:'qa308',...session,active:true});
        saveJSON(LS.users,[getCurrentUser()]);saveJSON(LS.session,session);
        saveJSON(LS.patients,[{id:'p',dni:'00000001',lastName:'Paciente',firstNames:'Prueba'}]);
        saveJSON(LS.registry,[{id:'a',patientId:'p',active:true,bedId:'UTI-1',admDateTime:isoNowLocalFull()}]);
        hcBackendConfigured=()=>false;hc270CheckScope=()=>{};hcBackendScheduleUrgentPush=()=>{};hcBackendMarkLocalSavedSoon=()=>{};
        const now=Date.now(),day=isoNowLocalFull().slice(0,10),inst=localStorage.getItem(LS.backendRegistryId)||'inst';
        const shift={id:'workshift:'+inst+':qa308:'+day,kind:'work_shift',user:'qa308',institutionDataId:inst,dateLocal:day,startDateTime:new Date(now-3600000).toISOString(),endDateTime:new Date(now+3600000).toISOString(),services:['UTI']};
        localStorage.setItem('hc306.shift.'+inst+'.qa308',JSON.stringify(shift));
        selectedPatientId='p';medTab='ingreso';showAppByRole('medico');renderMed();
        localStorage.setItem('hc289.visual.qa308',JSON.stringify({mode:'light',font:'default',color:'default'}));window.hc289ApplyVisual();
      });
      if(width<800) {
        await page.locator('.hc308ModulePicker').selectOption('evolucion');
      } else await page.locator('[data-medtab=evolucion]').click();
      await page.locator('#btnNuevaEvo').click();
      await page.locator('#evo_dx').fill('Diagnóstico de prueba');
      await page.locator('#arm_on').check();
      const mode=page.locator('#arm_modo');
      const first=await mode.locator('option').evaluateAll(options=>options.find(o=>o.value)?.value);
      await mode.selectOption(first);
      const dynamic=page.locator('#armBlock input[type=number]').first();
      if(await dynamic.count()) await dynamic.fill('22');
      await page.locator('#btnEvoModeLibre').click();
      await page.locator('#evo_free').fill('Texto de prueba');
      await page.locator('#btnEvoModePlantilla').click();
      assert.equal(await page.locator('#evo_dx').inputValue(),'Diagnóstico de prueba');
      assert(await page.locator('#arm_on').isChecked());
      if(await dynamic.count())assert.equal(await dynamic.inputValue(),'22');
      await page.locator('#btnEvoModeLibre').click();
      assert.equal(await page.locator('#evo_free').inputValue(),'Texto de prueba');
      await page.locator('#btnSaveEvoFree').click();
      assert((await page.evaluate(()=>getClinical().p.evolucionesFull.at(-1).prettyText)).includes('Texto de prueba'));
      assert(await page.locator('#evoEditorWrap').isHidden());
      assert.equal(await page.locator('#evoOpenText').innerText(),'EVOLUCIÓN (TEXTO LIBRE)\n\nTexto de prueba');
      await page.locator('#evoList button').first().click();
      assert.equal(await page.locator('#evoList button[aria-pressed=true]').count(),1);
      await capture(page,'evolucion-'+width);
      if(width<800)await page.locator('#btnAccount').tap();
      else await page.locator('#btnAccount').hover();
      assert(await page.getByRole('group',{name:'Mi cuenta',exact:true}).isVisible());
      const menu=await page.locator('#hc289AccountMenu').boundingBox();
      assert(menu.x>=0&&menu.x+menu.width<=width+1);
      await capture(page,'cuenta-'+width);
      await page.keyboard.press('Escape');
      await page.evaluate(()=>{
        saveJSON(LS.globalAuthUser,{username:'qa308',name:'Profesional de prueba',role:'medico'});
        return hc297Workspace('office');
      });
      const workspace=page.locator('#hc297Workspace');
      const professionalAvatar=workspace.locator('[data-pro-profile]');
      const accountMenu=page.locator('#hc289AccountMenu');
      if(width<800){
        await professionalAvatar.tap();
        await accountMenu.waitFor();
        await professionalAvatar.tap();
      }else{
        await professionalAvatar.hover();
        await accountMenu.waitFor();
        await professionalAvatar.click();
      }
      await page.locator('#hc289Dialog').getByRole('heading',{name:'Perfil',exact:true}).waitFor();
      await page.locator('#hc289Dialog').getByRole('button',{name:'Apariencia',exact:true}).click();
      await page.locator('#hc289Dialog [data-vmode=dark]').waitFor();
      await page.locator('#hc289Dialog [data-289-close]').click();
      await page.locator('#hc297Workspace [data-settings]').click();
      const agenda=page.locator('.hc298Compact');
      await agenda.waitFor();
      assert(await agenda.locator('summary img[alt="Foto de perfil"]').isVisible());
      const proDate=agenda.locator('.hc310MonthGrid:not([inert]) [data-day-key="'+today+'"]');
      await agenda.getByRole('button',{name:/Persona próxima/}).waitFor();
      assert.equal(await proDate.getAttribute('data-state'),'future');
      const nextMonth=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7)),1)).toISOString().slice(0,10);
      await agenda.getByRole('button',{name:'Mes siguiente'}).click();
      await agenda.locator('.hc310MonthGrid:not([inert]) [data-day-key="'+nextMonth+'"][aria-pressed=true]').waitFor();
      await agenda.getByRole('button',{name:'Mes anterior'}).click();
      await agenda.getByRole('button',{name:/Persona próxima/}).waitFor();
      await proDate.click();
      const weekDay=new Date(today+'T12:00:00').getDay();
      const weekday=agenda.locator('[data-day="'+weekDay+'"]');
      assert(await weekday.isVisible());
      assert.equal(await agenda.locator('[name=specialty]').inputValue(),'');
      await agenda.locator('[name=display_name]').fill('Profesional de prueba');
      await agenda.locator('[name=specialty]').selectOption({label:'Cardiología'});
      await agenda.locator('[name=credential]').fill('Matrícula ficticia');
      await agenda.locator('[name=enabled]').check();
      await weekday.locator('[data-active]').check();
      await agenda.locator('[name=rate30]').fill('1800');
      await agenda.locator('[type=submit]').click();
      await agenda.getByText(/agregá la dirección del consultorio/).waitFor();
      assert(await weekday.locator('[data-address]').evaluate(el=>el===document.activeElement));
      await weekday.locator('[data-address]').fill('Calle ficticia 123');
      await capture(page,'agenda-'+width);
      const saved=page.waitForRequest(req=>req.method()==='POST' && req.postDataJSON()?.action==='saveProfile');
      await agenda.locator('[type=submit]').click();
      assert((await saved).postDataJSON().profile.modes.office.rates.some(rate=>rate.minutes===30&&rate.amount_cents===180000));
      await agenda.getByText(/Guardado en el servidor/).waitFor();
      await agenda.getByRole('button',{name:/Persona próxima/}).click();
      await workspace.locator('[data-visit-back]').click();
      await workspace.locator('[data-visit-filter]').selectOption('past');
      assert(await workspace.getByRole('button',{name:/Persona anterior/}).isVisible());
      await workspace.locator('[data-visit-filter]').selectOption('next');
      await workspace.getByRole('button',{name:/Persona próxima/}).click();
      const note=workspace.locator('textarea[name=plan]');
      await note.fill('Texto inicialmente guardado');
      const pendingSave=page.waitForRequest(req=>req.method()==='POST' && req.postDataJSON()?.action==='saveClinicalRecord');
      await workspace.getByRole('button',{name:'Guardar evolución'}).click();
      await pendingSave;
      await note.fill('Borrador nuevo');
      resolveNote();
      await workspace.getByText(/cambios posteriores pendientes/).waitFor();
      await workspace.locator('[data-visit-back]').click();
      await workspace.getByRole('button',{name:/Persona próxima/}).click();
      await note.waitFor();
      assert.equal(await note.inputValue(),'Borrador nuevo');
      await workspace.getByRole('button',{name:'Avisos · 1'}).click();
      await page.locator('#hc289Dialog').getByRole('button',{name:'Ver turno',exact:true}).click();
      await workspace.getByRole('heading',{name:'Paciente de domicilio'}).waitFor();
      assert.equal(await workspace.getAttribute('data-mode'),'home');
      await page.evaluate(()=>document.querySelector('#hc297Workspace')?.remove());
      await page.evaluate(()=>hc289EnterClient({token:'fixture',user:{username:'test',name:'Paciente de prueba',role:'cliente'}}));
      const portal=page.locator('#hc289Portal');
      const home=page.locator('[data-hc310-home]');
      const toggle=page.locator('.hc310SideToggle');
      const openSidebar=async()=>{if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();};
      assert.equal(await portal.locator('.hc305PortalNav').count(),0);
      const start=portal.locator('.hc310CalendarTall .hc310MonthGrid:not([inert]) [data-day-key="'+today+'"]');
      await start.waitFor();
      const equal=await portal.locator('.hc310MonthGrid:not([inert])').first().locator('button').evaluateAll(buttons=>{
        const dims=buttons.map(b=>b.getBoundingClientRect());
        return Math.max(...dims.map(d=>d.height))-Math.min(...dims.map(d=>d.height))<1 &&
          Math.max(...dims.map(d=>d.width))-Math.min(...dims.map(d=>d.width))<1;
      });
      assert(equal,'Calendar cells have the same dimensions');
      for(const theme of ['light','dark']){
        await page.evaluate(theme=>{localStorage.setItem('hc289.visual.test',JSON.stringify({mode:theme,color:'default'}));hc289ApplyVisual();},theme);
        await contrast(start);
        await contrast(portal.locator('.hc310MonthHeader h2'));
      }
      await capture(page,'calendario-'+width);
      if(width>800){
        const vp=await portal.locator('.hc310CalendarViewport').boundingBox();
        const transform=await portal.locator('.hc310CalendarTrack').evaluate(e=>e.style.transform);
        await page.mouse.move(vp.x+vp.width*.7,vp.y+80);await page.mouse.down();
        await page.mouse.move(vp.x+vp.width*.35,vp.y+80,{steps:6});
        assert.notEqual(await portal.locator('.hc310CalendarTrack').evaluate(e=>e.style.transform),transform);
        await page.mouse.up();
        assert.equal(await page.evaluate(()=>getSelection().toString()),'');
        const divider=await portal.locator('.hc310Divider').boundingBox();
        const sidebarWidth=await portal.locator('#hc289Registry').evaluate(e=>e.offsetWidth);
        await page.mouse.move(divider.x+2,divider.y+100);await page.mouse.down();
        await page.mouse.move(divider.x+82,divider.y+100,{steps:5});await page.mouse.up();
        assert(await portal.locator('#hc289Registry').evaluate(e=>e.offsetWidth)>sidebarWidth+60);
      }
      const profile=page.locator('#hc289PortalAccount');
      if(width<800){
        await profile.tap();assert(await page.locator('#hc289AccountMenu').isVisible());
        await profile.tap();
      }else{
        await profile.hover();assert(await page.locator('#hc289AccountMenu').isVisible());
        await profile.click();
      }
      await portal.locator('#hc289Dialog').getByRole('heading',{name:'Perfil',exact:true}).waitFor();
      if(width<800)await profile.tap();else {
        await page.mouse.move(0,0);
        await profile.hover();
      }
      await accountMenu.getByRole('menuitem',{name:'Configuración'}).click();
      const patientSettings=portal.locator('#hc289Dialog .hc310Settings');
      await patientSettings.getByRole('button',{name:'Seguridad'}).click();
      await patientSettings.getByLabel('Contraseña actual').waitFor();
      await patientSettings.getByRole('button',{name:'Apariencia'}).click();
      await patientSettings.locator('[data-vmode=dark]').waitFor();
      await home.click();
      await openSidebar();
      await portal.getByRole('button',{name:'Mis Estudios'}).click();
      await portal.getByRole('heading',{name:/Mis estudios/i}).waitFor();
      await portal.getByRole('button',{name:'Informe de prueba'}).waitFor();
      await openSidebar();
      await portal.getByRole('button',{name:/Nuevo Turno/}).click();
      for(const care of ['institution','office','home','telemedicine','home']){
        await portal.locator('[data-care-mode="'+care+'"]').click();
        assert.equal(await portal.locator('[data-care-mode]:visible').count(),4);
        assert(await portal.locator('#hc289Urgent').isVisible());
      }
      await portal.locator('#hc289Urgent').check();
      await portal.getByRole('link',{name:'Llamar al 107'}).waitFor();
      await portal.locator('#hc289Urgent').uncheck();
      await portal.locator('.hc310MonthGrid:not([inert]) [data-day-key="'+today+'"]').click();
      const search=portal.getByRole('button',{name:'Buscar',exact:true});
      await search.click();
      await portal.getByText(/Conexión de prueba interrumpida/).waitFor();
      await search.click();
      await portal.locator('[data-result]').first().click();
      await portal.getByText(/El profesional actualizó sus tarifas/).waitFor();
      assert(await portal.locator('#hc292Reserve').isDisabled());
      await search.click();
      await portal.locator('[data-result]').first().click();
      await portal.locator('#hc292Plan').selectOption('30');
      await portal.locator('#hc292Slots button').first().click();
      await portal.locator('#hc292Accept').check();
      assert(await portal.locator('#hc292Reserve').isDisabled());
      await portal.locator('#hc310Address').fill('Calle ficticia 123');
      await portal.locator('#hc292Reserve').click();
      await portal.locator('#hc289Dialog').getByText(/Prueba gratuita confirmada/).waitFor();
      assert.equal(reserveRequests.length,1);
      assert.equal(reserveRequests[0].mode,'home');
      assert.equal(reserveRequests[0].homeAddress,'Calle ficticia 123');
      assert.equal(reserveRequests[0].minutes,30);
      assert(await portal.locator('header').isVisible());
      await portal.locator('[data-292-close]').click();
      await openSidebar();
      const row=portal.locator('[data-hc310-visit="visita-de-prueba"]');
      await row.click();
      await portal.locator('#hc289Dialog').getByText(/Domicilio:/).waitFor();
      if(width>800)assert(await row.isVisible());
      await capture(page,'turno-domicilio-'+width);
      await home.click();
      await openSidebar();
      await portal.getByRole('button',{name:/Nuevo Turno/}).click();
      await portal.locator('[data-care-mode=institution]').click();
      await portal.locator('.hc310MonthGrid:not([inert]) [data-day-key="'+today+'"]').click();
      await search.click();
      await portal.locator('[data-result]').first().click();
      await portal.locator('[data-slot-index]').first().click();
      assert(await portal.getByRole('button',{name:'Solicitar turno'}).isEnabled());
      assert.deepEqual(errors,[]);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      console.log('PASS',width,'ingreso, navegación, guardado, cuenta y reserva con cambio de día y cierre');
      await context.close();
    }
  } finally {await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
