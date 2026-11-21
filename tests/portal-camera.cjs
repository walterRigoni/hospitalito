const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.dirname(__dirname),site='https://walterrigoni.github.io/hospitalito/',checks=[];
const check=(value,name)=>{assert.ok(value,name);checks.push(name);globalThis.hc292CameraChecks=checks.slice();};
module.exports=async function run(options={}){
 let playwright=options.playwright;if(!playwright){try{playwright=require('playwright');}catch{playwright=require(require.resolve('playwright',{paths:[path.dirname(process.execPath),path.resolve(path.dirname(process.execPath),'..')]}));}}
 const browser=await playwright.chromium.launch({executablePath:options.executablePath,headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},permissions:['camera'],serviceWorkers:'block'}),page=await context.newPage(),errors=[],registrations=[];
  page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.__streams=[];window.__constraints=[];window.__cameraMode='normal';window.__revoked=[];
   const media=navigator.mediaDevices,original=media.getUserMedia.bind(media);
   media.getUserMedia=async options=>{
    __constraints.push(options);if(__cameraMode==='denied')throw new DOMException('Denied for test','NotAllowedError');
    const stream=await original(options);__streams.push(stream);
    if(__cameraMode==='delayed')await new Promise(resolve=>window.__releaseCamera=resolve);return stream;
   };
   const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{__revoked.push(url);revoke(url);};
   window.Tesseract={createWorker:async()=>({setParameters:async()=>{},recognize:async()=>({data:{text:window.__ocrText||'',confidence:96}}),terminate:async()=>{}})};
  });
  await page.route('**/*',async route=>{
   if(route.request().url()===site)return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'),'utf8')});
   if(route.request().url().includes('supabase.co')){
    let body={};try{body=route.request().postDataJSON()||{}}catch{}
    if(body.action==='register'){registrations.push(body);return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:false,error:'Fallo de prueba: formulario conservado'})});}
    return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,institutions:[],providers:[],rows:[],members:[],notifications:[]})});
   }
   return route.fulfill({status:404,body:''});
  });
  await page.goto(site);await page.locator('#hc289RegisterLink').click();
  const form=page.locator('#hc289Signup');
  const next=form.getByRole('button',{name:'Continuar',exact:true});
  const previous=form.getByRole('button',{name:'Anterior',exact:true});
  check(await form.locator('[name=username]').isVisible(),'Registration opens at the account step');
  await next.click();
  check(await form.locator('[name=username]').evaluate(node=>node===document.activeElement),'Missing login is focused');
  await form.locator('[name=username]').fill('camera_fixture@example.com');
  await form.locator('[name=password]').fill('local-only-fixture-password');
  await next.click();
  await next.click();
  check(await page.locator('#hc289SignupStatus').innerText()==='Agregá una foto del frente del DNI.','Registration identifies the missing photo');
  const front=page.locator('[data-document-side="front"]'),back=page.locator('[data-document-side="back"]');
  check(await front.locator('[data-open-camera]').isVisible()&&await back.locator('[data-open-camera]').isVisible(),'Camera is available on both DNI sides');
  check(await front.locator('[data-photo-source="album"]').getAttribute('accept')==='image/*','Album includes all image formats');
  check(await front.locator('[data-photo-source="camera"]').getAttribute('capture')==='environment','Native fallback requests rear camera');
  check(await front.locator('[data-photo-source="files"]').getAttribute('accept')===null,'Files fallback is not filtered by gallery image formats');
  const photo=async color=>Buffer.from(await page.evaluate(color=>{const c=document.createElement('canvas');c.width=480;c.height=300;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,480,300);return c.toDataURL('image/png').split(',')[1];},color),'base64');
  const red=await photo('#c00000'),blue=await photo('#0000c0');
  const choose=async(panel,source,buffer,name='foto-reciente.png',mimeType='image/png')=>{
   const pickerPromise=page.waitForEvent('filechooser');await panel.locator('[data-pick-document="'+source+'"]').click();const picker=await pickerPromise;
   await picker.setFiles(buffer?{name,mimeType,buffer}:[]);
   if(buffer)await panel.locator('.hc290PhotoStatus').filter({hasText:'Foto lista.'}).waitFor();
  };
  await choose(front,'album',red);const first=await front.locator('.hc290PhotoPreview img').getAttribute('src');
  check(await front.locator('.hc290PhotoPreview').isVisible(),'Album selection displays a preview');
  await page.evaluate(()=>window.__previousPicker=document.querySelector('[data-document-side="front"] [data-photo-source="album"]'));
  await choose(front,'album',blue);const replaced=await front.locator('.hc290PhotoPreview img').getAttribute('src');
  check(replaced!==first&&await page.evaluate(()=>!__previousPicker.isConnected),'Reopening creates a fresh picker and replaces same-named photos');
  check(await page.evaluate(url=>__revoked.includes(url),first),'Replacing a photograph releases its previous preview');
  await choose(front,'album',null);check(await front.locator('.hc290PhotoPreview img').getAttribute('src')===replaced,'Cancelling album selection preserves the chosen photograph');
  await front.locator('.hc291PhotoHelp summary').click();await choose(front,'files',red,'foto-reciente.heic','image/heic');
  check(await front.locator('.hc290PhotoPreview').isVisible(),'An image outside the old MIME whitelist reaches browser decoding');
  const valid=await front.locator('.hc290PhotoPreview img').getAttribute('src');
  await front.locator('[data-photo-source="files"]').setInputFiles({name:'incorrecto.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});
  await front.locator('.hc290PhotoStatus').filter({hasText:'Elegí un archivo de imagen'}).waitFor();
  check(await front.locator('.hc290PhotoPreview img').getAttribute('src')===valid,'Invalid replacement preserves the valid photo');
  await choose(back,'album',blue);const backBefore=await back.locator('.hc290PhotoPreview img').getAttribute('src');
  await front.locator('[data-open-camera]').click();await front.locator('[data-take-photo]:enabled').waitFor();
  check(await page.evaluate(()=>__constraints.at(-1).audio===false&&__constraints.at(-1).video.facingMode.ideal==='environment'),'Camera prefers rear lens and never requests the microphone');
  await front.locator('[data-take-photo]').click();await front.locator('.hc290PhotoStatus').filter({hasText:'Foto lista.'}).waitFor();
  check(await front.locator('.hc291Camera').isHidden(),'Taking a photo closes the camera preview');
  check(await page.evaluate(()=>__streams.at(-1).getTracks().every(t=>t.readyState==='ended')),'Taking a photo stops camera tracks');
  check(await back.locator('.hc290PhotoPreview img').getAttribute('src')===backBefore,'Front capture preserves the selected reverse');
  await page.evaluate(()=>__cameraMode='denied');const captured=await front.locator('.hc290PhotoPreview img').getAttribute('src');
  await front.locator('[data-open-camera]').click();await front.locator('[data-camera-status]').filter({hasText:'no dio permiso'}).waitFor();
  check(await front.locator('[data-pick-document="camera"]').isVisible(),'Denied permission offers native capture without losing the form');
  await choose(front,'camera',red);check(await front.locator('.hc290PhotoPreview img').getAttribute('src')!==captured,'Native camera fallback updates the photo');
  await page.evaluate(()=>{window.__getUserMedia=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=undefined;});
  const nativeFallback=page.waitForEvent('filechooser');await front.locator('[data-open-camera]').click();const fallbackPicker=await nativeFallback;
  check(await fallbackPicker.element().getAttribute('capture')==='environment','Browsers without webcam APIs open native rear-camera capture');
  const beforeNative=await front.locator('.hc290PhotoPreview img').getAttribute('src');await fallbackPicker.setFiles({name:'captura-nativa.png',mimeType:'image/png',buffer:red});await page.waitForFunction(previous=>document.querySelector('[data-document-side=front] .hc290PhotoPreview img').src!==previous,beforeNative);await front.locator('.hc290PhotoStatus').filter({hasText:'Foto lista.'}).waitFor();
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=__getUserMedia;__cameraMode='delayed';});await front.locator('[data-open-camera]').click();await page.waitForFunction(()=>typeof __releaseCamera==='function');
  await front.locator('[data-close-camera]').click();await page.evaluate(()=>__releaseCamera());
  await page.waitForFunction(()=>__streams.at(-1).getTracks().every(t=>t.readyState==='ended'));
  check(await front.locator('.hc291Camera').isHidden(),'Closing while permission is pending discards and stops a late stream');
  await page.evaluate(()=>__cameraMode='normal');await front.locator('[data-open-camera]').click();await front.locator('[data-take-photo]:enabled').waitFor();
  await back.locator('[data-open-camera]').click();await back.locator('[data-take-photo]:enabled').waitFor();
  check(await page.evaluate(()=>__streams.at(-2).getTracks().every(t=>t.readyState==='ended')),'Switching DNI sides stops the previous camera');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));check(await page.evaluate(()=>__streams.at(-1).getTracks().every(t=>t.readyState==='ended')),'Leaving the page stops the camera');
  check(registrations.length===0,'Selecting and capturing photos never submits a registration');
  await page.evaluate(()=>{window.__ocrText='Apellido PRUEBA\nNombre PERSONA\nDocumento 99.999.991\nFecha de nacimiento 01/01/1990';});
  await page.locator('#hc289Scan').click();
  await page.locator('#hc289OCRStatus').getByText(/Datos leídos/).waitFor();
  await next.click();
  check(await form.locator('[name=dni]').inputValue()==='99999991','OCR populates the review step without submitting');
  check(await form.locator('[name=name]').inputValue()==='PERSONA PRUEBA','OCR name is visible and editable on review');
  await form.locator('[name=name]').fill('PERSONA FICTICIA');await form.locator('[name=dni]').fill('99999991');await form.locator('[name=dob]').fill('1990-01-01');await form.locator('[name=confirmedData]').check();
  await form.locator('button[type=submit]').click();await page.locator('#hc289SignupStatus').filter({hasText:'Fallo de prueba'}).waitFor();
  check(registrations.length===1&&registrations[0].document.data.startsWith('data:image/jpeg;base64,')&&registrations[0].documentBack.data.startsWith('data:image/jpeg;base64,'),'Explicit registration converts both sources to server-compatible JPEGs');
  check(registrations[0].document.data!==registrations[0].documentBack.data,'Registration keeps the two DNI sides distinct');
  check(await form.locator('[name=name]').inputValue()==='PERSONA FICTICIA','Submission error preserves the review fields');
  await previous.click();
  check(await front.locator('.hc290PhotoPreview').isVisible()&&await back.locator('.hc290PhotoPreview').isVisible(),'A registration error preserves both photos');
  await front.locator('[data-remove-document]').click();check(await front.locator('.hc290PhotoPreview').isHidden()&&await back.locator('.hc290PhotoPreview').isVisible(),'Removing the front preserves the reverse');
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});check(await page.locator('#hc289Dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+2),'Registration fits viewport '+width);}
  await page.setViewportSize({width:390,height:844});await front.locator('legend').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,'camera-mobile-test.png')});
  await back.locator('[data-open-camera]').click();await back.locator('[data-take-photo]:enabled').waitFor();await page.locator('#hc289Dialog [data-289-close]').click();
  await page.waitForFunction(()=>__streams.at(-1).getTracks().every(t=>t.readyState==='ended'));check(true,'Closing the registration releases its camera');
  check(errors.length===0,'No uncaught browser errors: '+errors.join('; '));
  fs.writeFileSync(path.join(root,'camera-test-results.json'),JSON.stringify({checks,productionWrites:0,realCamerasUsed:0},null,2)+'\n');return {cameraChecks:checks.length,productionWrites:0,realCamerasUsed:0};
 }finally{await browser.close();}
};
if(require.main===module)module.exports({executablePath:process.env.BROWSER_EXECUTABLE||undefined}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.stack);process.exitCode=1});

