const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.equal(html, fs.readFileSync(path.join(root, 'Hospitalito_v308.html'), 'utf8'));
const site = 'https://walterrigoni.github.io/hospitalito/';
const screenshotDir = process.env.HC_VISUAL_DIR;
const date = new Date();
const month = date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0');
const provider = {id:'qa',role:'medico',name:'Profesional de prueba',institution_id:'inst',specialty:'Cardiología',private_practice:false};
async function capture(page,name) {
  if (!screenshotDir) return;
  fs.mkdirSync(screenshotDir,{recursive:true});
  await page.screenshot({path:path.join(screenshotDir,name+'.png'), animations:'disabled'});
}
async function run() {
  const browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined});
  try {
    for (const width of [390,320,1280]) {
      const context = await browser.newContext({viewport:{width,height:844},hasTouch:width<800,isMobile:width<800,serviceWorkers:'block'});
      const page = await context.newPage(), errors=[];
      page.setDefaultTimeout(8000);
      page.on('pageerror',error=>{errors.push(error.message);console.error('Error de interfaz:',error.stack);});
      await page.route('**/*',async route=>{
        if(route.request().url()===site) return route.fulfill({contentType:'text/html',body:html});
        const b=route.request().postDataJSON()||{};
        const responses={
          publicBranding:{settings:{programName:'Hospitalito'}},
          directory:{providers:[provider],institutions:[{id:'inst',name:'Centro de prueba'}]},
          me:{client:{username:'test',profile:{}},verifications:[{institution_id:'inst',status:'verified'}]},
          calendar:{days:[1,2].map(d=>({date:month+'-0'+d,free:1,total:1,slots:[{local:month+'-0'+d+'T12:00',available:true}]}))},
          myProfile:{role:'medico',professionalPhoto:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',profile:null},
          myVisits:{visits:[]}, clientData:{admissions:[],results:[],orders:[],bookings:[]}
        };
        if (route.request().url().includes('hospitalito-telemed')) {
          const office={enabled:true,rates:[{minutes:15,amount_cents:100000},{minutes:30,amount_cents:180000}],weekly:{days:Array.from({length:7},()=>({active:true}))}};
          if(b.action==='directory')return route.fulfill({json:{ok:true,providers:[{...provider,username:'qa',trialAvailable:true,modes:{office,telemedicine:office}}]}});
          if(b.action==='availability')return route.fulfill({json:{ok:true,providers:[{id:'qa',available:true}]}});
          if(b.action==='slots')return route.fulfill({json:{ok:true,profileRevision:1,slots:[{start:b.date+'T12:00:00Z',local:b.date+'T09:00',available:true,address:'Calle de prueba 100',location:'Consultorio',latitude:-31.4,longitude:-64.2}]}});
          if(b.action==='saveProfile')return route.fulfill({json:{ok:true,profile:{...b.profile,revision:1}}});
        }
        return route.fulfill({json:{ok:true,...responses[b.action]}});
      });
      await page.goto(site);
      await page.waitForSelector('#hc289RegisterLink');
      assert.equal(await page.locator('#loginWrap > .card #hc280DeviceLogin').count(),1);
      assert.equal(await page.locator('#hc307Version').innerText(),'v308');
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
      await page.locator('#btnAccount').click();
      assert(await page.getByRole('group',{name:'Mi cuenta',exact:true}).isVisible());
      const menu=await page.locator('#hc289AccountMenu').boundingBox();
      assert(menu.x>=0&&menu.x+menu.width<=width+1);
      await capture(page,'cuenta-'+width);
      await page.keyboard.press('Escape');
      await page.evaluate(()=>hc297Workspace('office'));
      await page.locator('#hc297Workspace [data-settings]').click();
      const agenda=page.locator('.hc298Compact');
      await agenda.waitFor();
      assert(await agenda.locator('summary img[alt="Foto de perfil"]').isVisible());
      if(width<800) {
        await agenda.locator('[data-day-tab="2"]').click();
        assert(await agenda.locator('[data-day="2"]').isVisible());
      }
      await agenda.locator('[name=specialty]').selectOption({label:'Cardiología'});
      await agenda.locator('[name=credential]').fill('Matrícula ficticia');
      await agenda.locator('[name=rate30]').fill('1800');
      await capture(page,'agenda-'+width);
      const saved=page.waitForRequest(req=>req.method()==='POST' && req.postDataJSON()?.action==='saveProfile');
      await agenda.locator('[type=submit]').click();
      assert((await saved).postDataJSON().profile.modes.office.rates.some(rate=>rate.minutes===30&&rate.amount_cents===180000));
      await agenda.getByText(/Guardado en el servidor/).waitFor();
      await agenda.locator('button[aria-label^="Cerrar"],[data-close]').first().click();
      await page.evaluate(()=>document.querySelector('#hc297Workspace')?.remove());
      await page.evaluate(()=>hc289EnterClient({token:'fixture',user:{username:'test',name:'Paciente de prueba',role:'cliente'}}));
      await page.locator('[data-hc305-nav=turnos]').click();
      assert(await page.getByRole('heading',{name:'Mis turnos',exact:true}).isVisible());
      await capture(page,'turnos-'+width);
      await page.locator('[data-hc305-nav=new]').click();
      await page.locator('#hc292SearchForm [name=mode]').selectOption('office');
      await page.locator('[data-tele-profile=qa]').click();
      await page.locator('#hc292Slots button').first().click();
      await page.locator('#hc292Accept').check();
      assert(await page.locator('#hc292Reserve').isEnabled());
      await page.locator('#hc292Plan').selectOption('30');
      assert(!(await page.locator('#hc292Accept').isChecked()));
      assert(await page.locator('#hc292Reserve').isDisabled());
      assert(await page.locator('#hc299Route').isHidden());
      await page.locator('[data-hc300-close-profile]').click();
      await page.locator('#hc292InstitutionSearch').click();
      await page.locator('[data-289-provider-detail=qa]').click();
      await page.locator('[data-289-day="'+month+'-01"]').click();
      await page.locator('#hc289Slots button').first().click();
      assert(await page.locator('#hc289Book').isEnabled());
      await page.locator('[data-289-day="'+month+'-02"]').click();
      assert(await page.locator('#hc289Book').isDisabled());
      await page.locator('#hc289Slots button').first().click();
      await page.locator('#hc289DetailClose').click();
      assert(await page.locator('#hc289Book').isDisabled());
      assert.deepEqual(errors,[]);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      console.log('PASS',width,'ingreso, navegación, guardado, cuenta y reserva con cambio de día y cierre');
      await context.close();
    }
  } finally {await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
