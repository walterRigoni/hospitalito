const fs292=require('node:fs/promises'),path=require('node:path');const root292=path.dirname(__dirname);module.exports=async function({playwright,executablePath}){var browser292=await playwright.chromium.launch({executablePath,headless:true});try{

var ocrContext292=await browser292.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),ocrPage292=await ocrContext292.newPage(),ocrCalls292=[];
await ocrPage292.route('**/*',async r=>{const url=r.request().url();if(url==='https://walterrigoni.github.io/hospitalito/')return r.fulfill({contentType:'text/html',body:await fs292.readFile(root292+'/index.html','utf8')});if(url.includes('supabase.co')){let b={};try{b=r.request().postDataJSON()}catch{}ocrCalls292.push(b);return r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,institutions:[],providers:[],rows:[],members:[],notifications:[]})});}try{const f=await fetch(url,{signal:AbortSignal.timeout(20000)});return r.fulfill({status:f.status,headers:{'content-type':f.headers.get('content-type')||'application/octet-stream','access-control-allow-origin':'*'},body:Buffer.from(await f.arrayBuffer())});}catch{return r.abort();}});
await ocrPage292.goto('https://walterrigoni.github.io/hospitalito/');
await ocrPage292.locator('#hc289RegisterLink').click();
var pngSmall292=await ocrPage292.evaluate(()=>{const c=document.createElement('canvas');c.width=1800;c.height=1100;const x=c.getContext('2d');x.fillStyle='#d7d9dd';x.fillRect(0,0,c.width,c.height);x.fillStyle='#fff';x.fillRect(260,140,1280,820);x.fillStyle='#101010';x.font='bold 36px Arial';x.fillText('DOCUMENTO FICTICIO PARA PRUEBAS',320,220);x.font='22px Arial';['Apellido','PRUEBA','Nombre','FICTICIA','Documento 99.999.991','Fecha de nacimiento','01 ENE / JAN 1990'].forEach((s,i)=>x.fillText(s,470,320+i*70));return c.toDataURL('image/png').split(',')[1];});
await ocrPage292.locator('#hc289Signup input[name=document]').setInputFiles({name:'DNI_FICTICIO_LETRAS_PEQUENAS.png',mimeType:'image/png',buffer:Buffer.from(pngSmall292,'base64')});
await ocrPage292.waitForFunction(()=>/Datos leídos|Reconocí|No pude|No se pudo/.test(document.querySelector('#hc289OCRStatus')?.textContent||''),{timeout:55000});
var ocrActual292=await ocrPage292.evaluate(()=>({status:document.querySelector('#hc289OCRStatus').textContent,dni:document.querySelector('#hc289Signup [name=dni]').value,dob:document.querySelector('#hc289Signup [name=dob]').value,name:document.querySelector('#hc289Signup [name=name]').value}));

if(ocrActual292.dni!=='99999991'||ocrActual292.dob!=='1990-01-01'||!ocrActual292.name.includes('FICTICIA'))throw Error('Small type OCR did not recover all synthetic fields');
await ocrContext292.close();return {read:ocrActual292,registrationRequests:ocrCalls292.filter(x=>x?.action==='register').length};

}finally{await browser292.close();}};
