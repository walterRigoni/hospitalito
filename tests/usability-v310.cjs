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
const tomorrow=new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);
const alternativeSlot={local:tomorrow+'T09:00',start:tomorrow+'T12:00:00Z',available:true,address:'Calle de prueba 100',location:'Consultorio',latitude:-31.4,longitude:-64.2};
const provider = {id:'qa',role:'medico',name:'Profesional de prueba',institution_id:'inst',specialty:'Cardiología',private_practice:false};
const nearProvider={...provider,id:'near',username:'near',name:'Zoe Consultorios'};
const unmappedProvider={...provider,id:'unknown',username:'unknown',name:'Ana Consultorios'};
const nearOffice={location:'Sede cercana',address:'Calle de prueba 42',latitude:-31.401,longitude:-64.201};
const farOffice={location:'Sede lejana',latitude:-31.47,longitude:-64.27};
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
    const style=getComputedStyle(el);
    const values=[lum(rgb(style.webkitTextFillColor||style.color)),lum(background)].sort((a,b)=>b-a);
    return (values[0]+0.05)/(values[1]+0.05);
  });
  assert(ratio>=4.5,'Insufficient contrast: '+ratio.toFixed(2));
}
async function centeredIcon(button, icon='svg') {
  await button.locator(':scope > '+icon).waitFor();
  const offset=await button.evaluate((element,selector)=>{
    const host=element.getBoundingClientRect();
    const glyph=element.querySelector(selector);
    const bounds=glyph.getBoundingClientRect();
    const painted=selector==='svg'?glyph.getBBox():null;
    return {x:bounds.x+bounds.width/2-host.x-host.width/2,
      y:bounds.y+bounds.height/2-host.y-host.height/2,
      opticalX:painted?painted.x+painted.width/2-12:0,
      opticalY:painted?painted.y+painted.height/2-12:0};
  },icon);
  assert(Math.abs(offset.x)<0.6&&Math.abs(offset.y)<0.6&&Math.abs(offset.opticalX)<0.6&&Math.abs(offset.opticalY)<0.6,
    'Icono descentrado: '+JSON.stringify(offset));
}
async function run() {
  const browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined});
  try {
    for (const width of [390,320,1280]) {
      const context = await browser.newContext({viewport:{width,height:844},hasTouch:width<800,isMobile:width<800,serviceWorkers:'block'});
      const page = await context.newPage(), errors=[],bookings=[],visits=[],reserveRequests=[],availabilityRequests=[];
      const identityPhotos=await page.evaluate(()=>['front','back'].map(side=>{
        const canvas=document.createElement('canvas');
        canvas.width=side==='front'?32:20;canvas.height=side==='front'?20:32;
        if(side==='front'){
          const ctx=canvas.getContext('2d');
          ctx.fillStyle='#ffff00';ctx.fillRect(16,10,16,10);
        }
        return {side,data:canvas.toDataURL('image/png')};
      }));
      await page.addInitScript(()=>{
        window.Tesseract={createWorker:async()=>({
          setParameters:async()=>{},
          recognize:async canvas=>{
            const [,green,blue]=canvas.getContext('2d').getImageData(2,2,1,1).data;
            return {data:{text:green>200&&blue<100?'ARGENTINA\nDOCUMENTO\nAPELLIDO':'',confidence:90}};
          },
          terminate:async()=>{}
        })};
      });
      let failDirectory=true,changedQuote=true,resolveNote;
      let fullyBooked=false, waitlist=[];
      let personal={address:'Dirección de prueba 42',phone:'1112345678',email:'paciente@example.test',latitude:-31.4,longitude:-64.2};
      let patient={username:'test',legal_name:'Paciente de prueba',dni:'12345678',dob:'1985-12-03'};
      const profileRequest=()=>({client:{...patient,profile:personal},verifications:[{institution_id:'inst',status:'verified'}]});
      const prior={id:'consulta-anterior',mode:'office',status:'finished',starts_at:new Date(date.getTime()-86400000).toISOString(),minutes:30,is_trial:true,peer_name:'Persona anterior'};
      const upcoming={...prior,id:'consulta-proxima',status:'confirmed',starts_at:new Date(today+'T23:59:00-03:00').toISOString(),peer_name:'Persona próxima',location_snapshot:'Consultorio · Calle ficticia 10'};
      const next = new Date(today+'T23:59:00-03:00');
      const nextDay=today;
      page.setDefaultTimeout(8000);
      page.on('pageerror',error=>{errors.push(error.message);console.error('Error de interfaz:',error.stack);});
      await page.route('**/*',async route=>{
        if(route.request().url()===site) return route.fulfill({contentType:'text/html',body:html});
        if(route.request().url().includes('/storage/v1/object/sign/test/rx.pdf'))
          return route.fulfill({contentType:'application/pdf',body:'%PDF-1.4\n%%EOF'});
        const b=route.request().postDataJSON()||{};
        const responses={
          publicBranding:{settings:{programName:'Hospitalito'}},
          directory:{providers:[provider],institutions:[{id:'inst',name:'Centro de prueba'}]},
          me:profileRequest(),
          calendar:{days:[{date:today,free:1,total:1,slots:[{local:today+'T22:00',available:true}]},
            {date:tomorrow,free:1,total:1,slots:[alternativeSlot]}]},
          calendarVisits:{visits:b.mode==='office'?[upcoming]:[]},
          myReports:{reports:[{id:'r1',visit_id:'visita-de-prueba',name:'Informe de prueba'}]},
          myPrescriptions:{prescriptions:[{id:'rx1',visit_id:'visita-de-prueba',name:'Receta de prueba.pdf'}]},
          documentFile:{url:'https://frbuhczonftjtvmviehw.supabase.co/storage/v1/object/sign/test/rx.pdf',name:'Receta de prueba.pdf'},
          myIdentityDocuments:{documents:identityPhotos},
          myProfile:{role:'medico',professionalPhoto:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',profile:null},
          myVisits:{visits}, clientData:{admissions:[],results:[],orders:[],bookings},
          myWaitlist:{entries:waitlist}
        };
        if(b.action==='joinWaitlist'){
          waitlist=[{id:'wait-test',from_day:b.date,until_day:tomorrow,mode:b.mode,role:b.role,specialty:b.specialty}];
          return route.fulfill({json:{ok:true,entry:waitlist[0]}});
        }
        if(b.action==='leaveWaitlist'){
          waitlist=waitlist.filter(entry=>entry.id!==b.id);
          return route.fulfill({json:{ok:true}});
        }
        if(b.action==='rescheduleBooking'||b.action==='bookingStatus'){
          const found=bookings.find(v=>v.id===b.id);
          assert.equal(b.previousStart,found.starts_at);
          if(b.action==='rescheduleBooking')found.starts_at=new Date(b.startLocal+':00-03:00').toISOString();
          else found.status='cancelled';
          return route.fulfill({json:{ok:true,booking:found}});
        }
        if(b.action==='updateClientProfile'){
          personal={...personal,...b.profile};
          return route.fulfill({json:{ok:true,...profileRequest()}});
        }
        if(b.action==='updateProfile'){
          const user=b.token==='fixture'?{username:'test',name:'Paciente de prueba',role:'cliente'}:{username:'qa308',name:'Profesional de prueba',role:'medico'};
          return route.fulfill({json:{ok:true,user:{...user,...b.user}}});
        }
        if (route.request().url().includes('hospitalito-telemed')) {
          const office={enabled:true,rates:[{minutes:15,amount_cents:100000},{minutes:30,amount_cents:180000}],weekly:{days:Array.from({length:7},()=>({active:true}))}};
          if(b.action==='directory' && failDirectory) {failDirectory=false;return route.fulfill({status:503,json:{ok:false,error:'Conexión de prueba interrumpida'}});}
          if(b.action==='directory')return route.fulfill({json:{ok:true,providers:[
            {...provider,username:'qa',revision:1,trialAvailable:true,modes:{office,telemedicine:office,home:office}},
            ...[nearProvider,unmappedProvider].map(profile=>({...profile,modes:{office}}))
          ]}});
          if(b.action==='availability'){
            availabilityRequests.push(b);
            if(fullyBooked&&b.date===today)return route.fulfill({json:{ok:true,providers:[]}});
            return route.fulfill({json:{ok:true,providers:[
              {id:'qa',available:true,locations:[farOffice]},
              {id:'near',available:true,locations:[{latitude:-31.6,longitude:-64.6},nearOffice]},
              {id:'unknown',available:true,locations:[]}
            ]}});
          }
          if(b.action==='nextSlots'){
            assert.equal(b.firstDay,tomorrow);
            return route.fulfill({json:{ok:true,providers:[{id:'qa',slots:[alternativeSlot]}]}});
          }
          if(b.action==='rescheduleSlots')return route.fulfill({json:{ok:true,slots:[alternativeSlot]}});
          if(b.action==='reschedule'||b.action==='cancel'){
            const found=visits.find(v=>v.id===b.visitId);
            assert.equal(b.previousStart,found.starts_at);
            if(b.action==='reschedule')found.starts_at=b.start;
            else found.status='cancelled';
            return route.fulfill({json:{ok:true,visit:found}});
          }
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
          if(b.action==='myVisits'&&b.token==='fixture-professional')return route.fulfill({json:{ok:true,visits:[prior,upcoming]}});
          if(b.action==='notifications'&&b.token!=='fixture-professional')return route.fulfill({json:{ok:true,notifications:[{
            id:'recordatorio-ficticio',kind:'tele_reminder',title:'Recordatorio de turno · 24 horas',body:'Turno de prueba'
          },...waitlist.map(()=>({
            id:'wait-notice-ficticio',kind:'appointment_waitlist',title:'Se liberó un turno',body:'Horario ficticio',
            payload:{mode:'office',providerId:'qa',role:'medico',specialty:'Cardiología',local:alternativeSlot.local,minutes:15}
          }))]}});
          if(b.action==='notifications'&&b.token==='fixture-professional')return route.fulfill({json:{ok:true,notifications:[{
            id:'aviso-ficticio',kind:'tele_booking',title:'Nueva solicitud de turno',body:'Atención a Domicilio',
            payload:{visitId:'aviso-domicilio',mode:'home'}
          }]}});
          if(b.action==='visitDirections')return route.fulfill({json:{ok:true,distance:1500,duration:150,steps:['Girás a la derecha']}});
          if(b.action==='visit'&&b.visitId==='aviso-domicilio')return route.fulfill({json:{ok:true,side:'provider',visit:{...upcoming,mode:'home'},peerName:'Paciente de domicilio'}});
          if(b.action==='clinicalRecord')return route.fulfill({json:{ok:true,note:null,history:[]}});
          if(b.action==='saveClinicalRecord'){
            await new Promise(resolve=>{resolveNote=resolve;});
            return route.fulfill({json:{ok:true,note:{revision:1}}});
          }
          if(b.action==='visit'&&b.token==='fixture-professional')return route.fulfill({json:{ok:true,side:'provider',visit:upcoming,peerName:upcoming.peer_name}});
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
      assert.equal(await page.locator('.hc308ModulePicker').count(),0);
      await page.locator('[data-medtab=evolucion]').click();
      await page.locator('#btnNuevaEvo').click();
      await page.locator('#evo_dx').fill('Diagnóstico de prueba');
      await page.locator('#arm_on').check();
      const mode=page.locator('#arm_modo');
      const first=await mode.locator('option').evaluateAll(options=>options.find(o=>o.value)?.value);
      await mode.selectOption(first);
      const dynamic=page.locator('#armBlock input[type=number]').first();
      if(await dynamic.count()) await dynamic.fill('22');
      await page.locator('#btnEvoModeLibre').click();
      await page.locator('#evo_free + .hc320Rich .hc320RichInput').fill('Texto de prueba');
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
      if(width===1280){
        await page.evaluate(()=>{
          const fixture=document.createElement('section');
          fixture.id='qa-contrast';
          fixture.innerHTML='<div class="heparinStatusBox"><p data-contrast>Estado de heparina</p><small class="muted" data-contrast>Último KPTT</small></div>'+
            '<div class="insulinProtocolFormBox"><label data-contrast>Protocolo de insulina<input data-contrast value="13:00"></label></div>'+
            '<div class="prEVRuleText"><p data-contrast>Regla de infusión</p></div>'+
            '<details class="nrMulti hasSelection"><summary data-contrast>Adjuntos seleccionados</summary></details>'+
            '<div id="medSV"><table class="svTable"><tbody><tr><td class="sv-good" data-contrast>95</td><td class="sv-bad" data-contrast>85</td></tr></tbody></table></div>'+
            '<article class="pacBar"><div class="l1" data-contrast>Paciente de prueba</div></article>';
          document.querySelector('#medPanel').append(fixture);
        });
        for(const mode of ['light','dark','light']){
          await page.evaluate(mode=>{localStorage.setItem('hc289.visual.qa308',JSON.stringify({mode,color:'green'}));window.hc289ApplyVisual();},mode);
          for(const cell of await page.locator('#qa-contrast [data-contrast]').all())await contrast(cell);
        }
        await page.evaluate(()=>document.querySelector('#qa-contrast').remove());
        await page.evaluate(()=>hcSettingsOpen('account'));
        const title=page.locator('#hcSettingsContent [data-hc314-row=professionalTitle]');
        assert.equal(await title.locator('input').count(),0);
        await title.getByRole('button',{name:'Editar Título profesional'}).click();
        await title.getByRole('textbox',{name:'Título profesional'}).fill('Título de prueba');
        await title.getByRole('button',{name:'Guardar',exact:true}).click();
        await title.getByText('Título de prueba').waitFor();
        assert.equal(await page.evaluate(()=>getUsers().find(user=>user.username==='qa308').professionalTitle),'Título de prueba');
        await page.evaluate(()=>hcSettingsOpen('personalization'));
        const institutional=page.locator('#hcSettingsContent .hc313Format');
        assert.equal(await institutional.getByLabel('Formato de fecha').inputValue(),'dmy');
        assert.equal(await institutional.getByLabel('Formato de hora').inputValue(),'24h');
        await institutional.getByLabel('Formato de hora').selectOption('12h');
        assert.equal(await page.evaluate(()=>dmyhmFromISODateTime('2026-11-12T13:00')),'12/11/2026 1:00 p. m.');
        await institutional.getByLabel('Formato de hora').selectOption('24h');
        await page.locator('#hcSettingsCloseBtn').click();
      }
      await capture(page,'evolucion-'+width);
      await centeredIcon(page.locator('#btnAccount'));
      if(width<800)await page.locator('#btnAccount').tap();
      else await page.locator('#btnAccount').hover();
      assert(await page.getByRole('group',{name:'Mi cuenta',exact:true}).isVisible());
      const menu=await page.locator('#hc289AccountMenu').boundingBox();
      assert(menu.x>=0&&menu.x+menu.width<=width+1);
      await capture(page,'cuenta-'+width);
      await page.keyboard.press('Escape');
      await page.evaluate(()=>{
        saveJSON(LS.globalAuthUser,{username:'qa308',name:'Profesional de prueba',role:'medico'});
        localStorage.setItem(LS.globalAuthToken,'fixture-professional');
        return hc297Workspace('office');
      });
      const workspace=page.locator('#hc297Workspace');
      const professionalAvatar=workspace.locator('[data-pro-profile]');
      await centeredIcon(professionalAvatar);
      await professionalAvatar.evaluate(button=>{
        const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=';
        window.HC310.avatar(button,{photo});
      });
      await centeredIcon(professionalAvatar,'img');
      await professionalAvatar.evaluate(button=>window.HC310.avatar(button,{}));
      const accountMenu=page.locator('#hc289AccountMenu');
      const openProfessionalMenu=async()=>{
        if(!await accountMenu.isVisible()){
          if(width<800)await professionalAvatar.tap();else await professionalAvatar.click();
        }
        await accountMenu.waitFor();
      };
      await openProfessionalMenu();
      await accountMenu.getByRole('menuitem',{name:'Cambiar lugar de atención'}).click();
      await page.locator('#btnCloseInstitutionChooser').click();
      assert.equal(await workspace.getAttribute('data-mode'),'office');
      const workplaceDay=workspace.locator('[data-agenda-month] .hc310MonthGrid:not([inert]) [data-day-key="'+today+'"]');
      await workplaceDay.click();
      await workspace.locator('[data-agenda-day] [data-calendar-visit]').first().waitFor();
      const directions=workspace.locator('[data-agenda-day] [data-route-visit]').first();
      await directions.locator('summary').click();
      const origin={latitude:-31.4,longitude:-64.2};
      await page.evaluate(point=>{window.HC299Geo.locate=async()=>point;},origin);
      const routeRequest=page.waitForRequest(req=>req.method()==='POST'&&req.postDataJSON()?.action==='visitDirections');
      await directions.getByRole('button',{name:'Calcular desde mi ubicación'}).click();
      assert.deepEqual((await routeRequest).postDataJSON().origin,origin);
      await directions.getByText('Girás a la derecha').waitFor();
      await workspace.locator('[data-day-back]').click();
      await workspace.locator('[data-month-picker]').click();
      await page.locator('dialog[open] [name=month]').waitFor();
      await page.locator('dialog[open] [data-hc320-close]').click();
      await openProfessionalMenu();
      await accountMenu.getByRole('menuitem',{name:'Perfil',exact:true}).click();
      await page.locator('#hcSettingsModal').getByRole('heading',{name:'Perfil',exact:true}).waitFor();
      const professionalName=page.locator('#hcSettingsContent [data-hc314-row=name]');
      await professionalName.getByText('Profesional de prueba').waitFor();
      await professionalName.getByRole('button',{name:'Editar Nombre visible'}).click();
      const nameEditor=professionalName.getByRole('textbox',{name:'Nombre visible'});
      await nameEditor.fill('Borrador de prueba');
      await professionalName.getByRole('button',{name:'Cancelar'}).click();
      assert.equal(await nameEditor.count(),0);
      await professionalName.getByText('Profesional de prueba').waitFor();
      await page.locator('#hcSettingsCloseBtn').click();
      await openProfessionalMenu();
      await accountMenu.getByRole('menuitem',{name:'Configuración',exact:true}).click();
      await page.locator('#hcSettingsContent [data-vmode=dark]').waitFor();
      const professionalFormat=page.locator('#hcSettingsContent .hc313Format');
      await professionalFormat.getByLabel('Formato de fecha').selectOption('iso');
      await professionalFormat.getByLabel('Formato de hora').selectOption('12h');
      assert.equal(await page.evaluate(()=>dmyhmFromISODateTime('2026-11-12T13:00')),'2026-11-12 1:00 p. m.');
      await professionalFormat.getByLabel('Formato de fecha').selectOption('dmy');
      await professionalFormat.getByLabel('Formato de hora').selectOption('24h');

      await page.locator('#hcSettingsCloseBtn').click();
      await openProfessionalMenu();
      await accountMenu.getByRole('menuitem',{name:'Días, horarios y tarifas',exact:true}).click();
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
      const note=workspace.locator('textarea[name=plan] + .hc320Rich .hc320RichInput');
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
      assert.equal(await note.innerText(),'Borrador nuevo');
      await openProfessionalMenu();
      await accountMenu.getByRole('menuitem',{name:'Avisos',exact:true}).click();
      await page.locator('#hcSettingsContent').getByRole('button',{name:'Ver turno',exact:true}).click();
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
      await portal.locator('[data-hc310-reminders]').filter({hasText:'Avisos · 1'}).waitFor({state:'attached'});
      const equal=await portal.locator('.hc310MonthGrid:not([inert])').first().locator('button').evaluateAll(buttons=>{
        const dims=buttons.map(b=>b.getBoundingClientRect());
        return Math.max(...dims.map(d=>d.height))-Math.min(...dims.map(d=>d.height))<1 &&
          Math.max(...dims.map(d=>d.width))-Math.min(...dims.map(d=>d.width))<1;
      });
      assert(equal,'Calendar cells have the same dimensions');
      for(const theme of ['light','dark']){
        await page.evaluate(theme=>{localStorage.setItem('hc289.visual.test',JSON.stringify({mode:theme,color:'default'}));hc289ApplyVisual();},theme);
        await contrast(start);
        await contrast(portal.locator('.hc310MonthHeader [data-month-picker]'));
      }
      await capture(page,'calendario-'+width);
      const mainPane=portal.locator('#hc289PortalMain');
      const closeToCalendar=mainPane.getByRole('button',{name:'Volver al calendario',exact:true});
      await start.click();
      await centeredIcon(closeToCalendar);
      assert.equal(await mainPane.getByRole('button',{name:/Nuevo turno|^‹ Calendario$/i}).count(),0);
      await closeToCalendar.click();
      await start.waitFor();
      if(width>800){
        const vp=await portal.locator('.hc310CalendarViewport').boundingBox();
        const transform=await portal.locator('.hc310CalendarTrack').evaluate(e=>e.style.transform);
        await page.mouse.move(vp.x+vp.width*.7,vp.y+80);await page.mouse.down();
        const cards=portal.locator('.hc310CalendarTrack > .hc310MonthGrid');
        const measure=()=>cards.evaluateAll(nodes=>nodes.map(node=>[
          Number(getComputedStyle(node).opacity),new DOMMatrix(getComputedStyle(node).transform).a
        ]));
        await page.mouse.move(vp.x+vp.width*.67,vp.y+80);
        const early=await measure();
        await page.mouse.move(vp.x+vp.width*.21,vp.y+80,{steps:6});
        const middle=await measure();
        assert(early[2][0]<.25&&early[2][1]<.85);
        assert(middle[2][0]>early[2][0]&&middle[2][1]>early[2][1]);
        assert(middle[1][0]<early[1][0]&&middle[1][1]<early[1][1]);
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
      await centeredIcon(profile);
      await centeredIcon(portal.getByRole('button',{name:'Mes anterior'}));
      await centeredIcon(portal.getByRole('button',{name:'Mes siguiente'}));
      await centeredIcon(portal.locator('.hc310SideToggle'));
      assert.equal(await portal.locator('[data-portal-section][aria-current=page]').count(),0);
      if(width<800){
        await portal.getByRole('button',{name:'Opciones de cuenta'}).tap();
        await accountMenu.getByRole('menuitem',{name:'Perfil',exact:true}).click();
        await portal.locator('#hc289Dialog [data-client-settings=account]').waitFor();
        await portal.locator('#hc289Dialog [data-289-close]').click();
        await profile.tap();
      }else{
        await profile.hover();assert(await page.locator('#hc289AccountMenu').isVisible());
        await profile.click();
      }
      const accountPanel=portal.locator('#hc289Dialog');
      await accountPanel.getByRole('heading',{name:'Perfil',exact:true}).waitFor();
      assert.equal(await accountPanel.locator('[data-client-settings]').count(),4);
      assert.equal(await accountPanel.locator('[data-client-settings=account]').getAttribute('aria-current'),'page');
      const telephone=accountPanel.locator('[data-hc314-row=phone]');
      const pencil=telephone.getByRole('button',{name:'Editar Teléfono'});
      assert.equal(await accountPanel.locator('input').count(),0);
      await telephone.getByText('1112345678').waitFor();
      assert.equal(await accountPanel.locator('[data-hc314-row=dni] button').count(),0);
      assert.equal(await pencil.evaluate(e=>getComputedStyle(e).opacity),width<800?'1':'0');
      if(width>800)await telephone.hover();
      assert.equal(await pencil.evaluate(e=>getComputedStyle(e).opacity),'1');
      await pencil.click();
      const phoneInput=telephone.getByRole('textbox',{name:'Teléfono'});
      assert.equal(await phoneInput.inputValue(),'1112345678');
      await phoneInput.fill('1100001122');
      await telephone.getByRole('button',{name:'Guardar',exact:true}).click();
      await telephone.getByText('1100001122').waitFor();
      assert.equal(personal.address,'Dirección de prueba 42');
      assert.equal(personal.email,'paciente@example.test');
      const savedPhoto=accountPanel.locator('#hc290MyDocuments .hc290SavedDocument');
      const frontFrame=savedPhoto.nth(0).locator('.hc316DniFrame');
      const backFrame=savedPhoto.nth(1).locator('.hc316DniFrame');
      const rotateReverse=savedPhoto.nth(1).getByRole('button',{name:'Girar dorso del DNI 90°'});
      await accountPanel.locator('#hc290MyDocuments [data-dni-rotate]:enabled').first().waitFor();
      await savedPhoto.nth(1).locator('[data-dni-rotate]:enabled').waitFor();
      await savedPhoto.nth(0).locator('.hc316DniFrame[data-dni-turns="2"]').waitFor();
      assert.equal(await backFrame.getAttribute('data-dni-turns'),'1');
      const reverseBounds=await backFrame.boundingBox();
      assert(reverseBounds.width/reverseBounds.height>1.5);
      await rotateReverse.click();
      assert.equal(await backFrame.getAttribute('data-dni-turns'),'2');
      assert.equal(await frontFrame.getAttribute('data-dni-turns'),'2');
      assert.equal(await backFrame.getAttribute('href'),identityPhotos[1].data);
      if(width>800){
        const layout=await accountPanel.evaluate(el=>{
          const outer=el.getBoundingClientRect(),nav=el.querySelector('.hcSettingsNav').getBoundingClientRect(),stage=el.querySelector('.hcSettingsStage').getBoundingClientRect();
          return {left:nav.left-outer.left,right:outer.right-stage.right,height:outer.height,stageWidth:stage.width};
        });
        assert(Math.abs(layout.left-layout.right)<2&&layout.left<36&&layout.stageWidth>900,JSON.stringify(layout));
      }
      await centeredIcon(accountPanel.getByRole('button',{name:'Cerrar',exact:true}));
      await accountPanel.getByRole('button',{name:'Cerrar',exact:true}).click();
      await profile.press('ArrowDown');
      await accountMenu.getByRole('menuitem',{name:'Configuración'}).click();
      const patientSettings=portal.locator('#hc289Dialog .hc310Settings');
      const accountBounds=await accountPanel.boundingBox();
      assert.equal(accountBounds.width,width);
      assert.equal(accountBounds.height,844);
      for(const theme of ['light','dark']){
        await patientSettings.locator('[data-vmode='+theme+']').click();
        await contrast(patientSettings.locator('[data-vmode='+theme+']'));
        await contrast(patientSettings.locator('[aria-current=page]'));
        await contrast(accountPanel.getByRole('button',{name:'Cerrar',exact:true}));
      }
      const patientFormat=patientSettings.locator('.hc313Format');
      const actualExamples=await page.evaluate(()=>{
        const now=new Date();
        return {
          date:HC313.date(now,{timeZone:HC313.argentina}),
          iso:new Intl.DateTimeFormat('fr-CA',{timeZone:HC313.argentina,year:'numeric',month:'2-digit',day:'2-digit'}).format(now),
          time:HC313.time(now,{timeZone:HC313.argentina})
        };
      });
      assert.deepEqual(await patientFormat.getByLabel('Formato de fecha').locator('option').allTextContents(),[actualExamples.date,actualExamples.iso]);
      assert.match((await patientFormat.getByLabel('Formato de hora').locator('option').allTextContents())[0],/^\d{2}:\d{2} \(24 horas\)$/);

      assert.equal(await patientFormat.getByLabel('Formato de fecha').inputValue(),'dmy');
      assert.equal(await patientFormat.getByLabel('Formato de hora').inputValue(),'24h');
      await patientFormat.getByLabel('Formato de fecha').selectOption('iso');
      await patientFormat.getByLabel('Formato de hora').selectOption('12h');
      assert.equal(await page.evaluate(()=>dmyhmFromISODateTime('2026-11-12T13:00')),'2026-11-12 1:00 p. m.');
      const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('hc289.visual.test')));
      assert.equal(stored.dateFormat,'iso');
      assert.equal(stored.timeFormat,'12h');
      await patientFormat.getByLabel('Formato de fecha').selectOption('dmy');
      await patientFormat.getByLabel('Formato de hora').selectOption('24h');
      await patientSettings.locator('.hc311Font summary').click();
      assert.match(await patientSettings.getByText('Georgia',{exact:true}).evaluate(e=>getComputedStyle(e).fontFamily),/Georgia/);
      await patientSettings.getByText('Georgia',{exact:true}).click();
      assert.match(await patientSettings.locator('.hc311Font summary').innerText(),/Georgia/);
      await patientSettings.getByRole('button',{name:'Avisos de turnos'}).click();
      await patientSettings.getByRole('checkbox',{name:/avisos emergentes/}).uncheck();
      assert.equal(await page.evaluate(()=>localStorage.getItem('hc311.patientReminders.test')),'off');
      await patientSettings.getByRole('button',{name:'Seguridad'}).click();
      await patientSettings.getByLabel('Contraseña actual').waitFor();
      await patientSettings.getByRole('button',{name:'Apariencia'}).click();
      await patientSettings.locator('[data-vmode=dark]').waitFor();
      await accountPanel.getByRole('button',{name:'Cerrar',exact:true}).click();
      await home.click();
      const noSelection=async()=>{
        await portal.locator('#hc289PortalMain .hc310CalendarTall').waitFor();
        assert.equal(await portal.locator('[data-portal-section][aria-current=page]').count(),0);
      };
      await noSelection();
      for(const section of ['turns','studies','alerts','prescriptions']){
        const item=portal.locator('[data-portal-section='+section+']');
        const chooseSection=async()=>{await openSidebar();await item.click();};
        await chooseSection();
        assert.equal(await item.getAttribute('aria-current'),'page');
        await chooseSection();
        await noSelection();
        await chooseSection();
        const close=portal.locator('#hc289PortalMain').getByRole('button',
          {name:section==='alerts'?'Cerrar':'Volver al calendario',exact:true});
        await centeredIcon(close);
        if(section==='turns'){
          await page.locator('#hc289PortalMain [data-hc305-refresh]:enabled').waitFor();
          const spacing=await portal.locator('#hc289PortalMain .hc314SectionActions').evaluate(row=>{
            const refresh=row.querySelector('[data-hc305-refresh]').getBoundingClientRect();
            return row.querySelector('[data-hc314-close-section]').getBoundingClientRect().left-refresh.right;
          });
          assert(spacing>=6,'Actualizar queda a la izquierda de la cruz');
        }
        if(section==='studies')assert.equal(await portal.locator('#hc289PortalMain [data-289-back]').count(),0);
        await close.click();
        await noSelection();
      }
      await openSidebar();
      await portal.getByRole('button',{name:'Mis Recetas'}).click();
      await portal.getByRole('heading',{name:'Mis Recetas'}).waitFor();
      assert.equal(await portal.locator('[data-portal-section=prescriptions]').getAttribute('aria-current'),'page');
      const download=page.waitForEvent('download');
      await portal.getByRole('button',{name:'Receta de prueba.pdf'}).click();
      assert.equal((await download).suggestedFilename(),'Receta de prueba.pdf');
      await openSidebar();
      await portal.getByRole('button',{name:'Mis Estudios'}).click();
      await portal.getByRole('heading',{name:/Mis estudios/i}).waitFor();
      await portal.getByRole('button',{name:'Informe de prueba'}).waitFor();
      await openSidebar();
      await portal.getByRole('button',{name:/Nuevo Turno/}).click();
      await centeredIcon(closeToCalendar);
      assert.equal(await mainPane.locator('[data-hc310-close]').count(),0);
      await closeToCalendar.click();
      await noSelection();
      await openSidebar();
      await portal.getByRole('button',{name:/Nuevo Turno/}).click();
      for(const care of ['institution','office','home','telemedicine','home']){
        await portal.locator('[data-care-mode="'+care+'"]').click();
        assert.equal(await portal.locator('[data-care-mode]:visible').count(),4);
        assert(await portal.locator('#hc289Urgent').isVisible());
      }
      await portal.locator('#hc289Urgent').check();
      const urgent=portal.getByRole('link',{name:'Llamar al 107'});
      await urgent.waitFor();
      assert.equal(await urgent.getAttribute('href'),'tel:107');
      assert.equal(await portal.locator('[data-booking-controls]').isVisible(),false);
      assert((await urgent.boundingBox()).height>=112);
      await portal.locator('#hc289Urgent').uncheck();
      assert.equal(await urgent.isVisible(),false);
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
      const useLocation=portal.getByRole('button',{name:'Usar mi ubicación actual'});
      assert.equal(await useLocation.isVisible(),false);
      await portal.locator('[data-care-mode=office]').click();
      await useLocation.waitFor();
      await portal.locator('.hc310MonthGrid:not([inert]) [data-day-key="'+today+'"]').click();
      await search.click();
      const resultNames=portal.locator('[data-result] b');
      await resultNames.nth(2).waitFor();
      assert.deepEqual(await resultNames.allTextContents(),[nearProvider.name,provider.name,unmappedProvider.name]);
      const nearest=portal.locator('[data-result]').first();
      assert.match(await nearest.innerText(),/Sede disponible a \d+ m · Sede cercana/);
      await contrast(nearest.locator('small').last());
      await portal.getByText('Distancia no disponible',{exact:true}).waitFor();
      await page.evaluate(()=>{window.HC299Geo.locate=async()=>{throw Error('Permiso de prueba denegado');};});
      await useLocation.click();
      await portal.getByText(/No pudimos obtener tu ubicación actual/).waitFor();
      assert.deepEqual(await resultNames.allTextContents(),[nearProvider.name,provider.name,unmappedProvider.name]);
      const searchCount=availabilityRequests.length;
      await page.evaluate(point=>{window.HC299Geo.locate=async()=>point;},farOffice);
      await useLocation.click();
      await portal.getByText('Distancias en línea recta desde tu ubicación actual.').waitFor();
      assert.deepEqual(await resultNames.allTextContents(),[provider.name,nearProvider.name,unmappedProvider.name]);
      assert.equal(availabilityRequests.length,searchCount);
      await portal.locator('[data-care-mode=institution]').click();
      assert.equal(await useLocation.isVisible(),false);
      await portal.locator('.hc310MonthGrid:not([inert]) [data-day-key="'+today+'"]').click();
      await search.click();
      await portal.locator('[data-result]').first().click();
      await portal.locator('[data-slot-index]').first().click();
      assert(await portal.getByRole('button',{name:'Solicitar turno'}).isEnabled());
      fullyBooked=true;
      await portal.locator('[data-care-mode=office]').click();
      await mainPane.getByLabel('Especialidad').selectOption('Cardiología');
      await search.click();
      const alternative=mainPane.locator('[data-next-offer]').first();
      await alternative.waitFor();
      assert.match(await alternative.innerText(),/09:00.*Profesional de prueba.*Calle de prueba 100.*10,2 km/s);
      await alternative.click();
      await mainPane.locator('#hc292Slots button[aria-pressed=true]').waitFor();
      assert(await mainPane.locator('#hc292Reserve').isDisabled());
      await mainPane.getByRole('button',{name:'Anotarme en lista de espera'}).click();
      await mainPane.getByText(/Quedaste en la lista/).waitFor();
      await openSidebar();
      await portal.locator('[data-portal-section=alerts]').click();
      await portal.getByRole('button',{name:'Consultar disponibilidad'}).click();
      await mainPane.locator('#hc292Slots button[aria-pressed=true]').waitFor();
      assert.equal(await mainPane.locator('#hc292Plan').inputValue(),'15');
      bookings.push({id:'institucional-prueba',provider_id:'qa',starts_at:next.toISOString(),status:'confirmed',provider_name:'Profesional institucional de prueba'});
      await openSidebar();
      await portal.locator('[data-portal-section=turns]').click();
      await mainPane.locator('[data-waitlist-panel] summary').click();
      await mainPane.getByRole('button',{name:'Salir de esta lista'}).click();
      await mainPane.getByText(/Podés anotarte en Nuevo Turno/).waitFor();
      for(const id of ['visita-de-prueba','institucional-prueba']){
        const trigger=action=>mainPane.locator('[data-appointment-id="'+id+'"][data-appointment-action="'+action+'"]');
        await trigger('move').click();
        await mainPane.getByLabel('Fecha nueva').fill(tomorrow);
        await mainPane.locator('[data-new-slots] button').first().click();
        await mainPane.getByRole('button',{name:'Confirmar reprogramación'}).click();
        await trigger('cancel').click();
        await mainPane.getByRole('button',{name:'Confirmar cancelación'}).click();
        await mainPane.getByRole('heading',{name:'Mis Turnos'}).waitFor();
      }
      assert.equal(visits[0].status,'cancelled');
      assert.equal(bookings[0].status,'cancelled');
      assert.deepEqual(errors,[]);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      console.log('PASS',width,'ingreso, navegación, guardado, cuenta y reserva con cambio de día y cierre');
      await context.close();
    }
  } finally {await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
