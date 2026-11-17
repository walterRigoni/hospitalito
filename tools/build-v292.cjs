const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.dirname(__dirname),read=p=>fs.readFileSync(path.join(root,p),'utf8'),write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
function replace(s,from,to){if(!s.includes(from))throw Error('Missing build anchor: '+from.slice(0,70));return s.replace(from,to);}
let portal=read('ui/v291-portal.js').trim();
portal=replace(portal,"const longest=Math.max(img.naturalWidth,img.naturalHeight),ratio=ocr?Math.min(2600/longest,Math.max(1,1600/longest)):Math.min(1,2000/longest);","const longest=Math.max(img.naturalWidth,img.naturalHeight),ratio=ocr?Math.min(2.5,3600/longest,Math.sqrt(8000000/(img.naturalWidth*img.naturalHeight)),Math.max(1,2400/longest)):Math.min(1,2000/longest);");
portal=replace(portal,"ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas;","ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,canvas.width,canvas.height);return ocr&&window.HC292OCR?window.HC292OCR.rotate(canvas,file.__hc292Rotation||0):canvas;");
portal=replace(portal,"panel.querySelector('.hc290PhotoStatus').textContent=p?'Foto lista.':'Sin foto seleccionada.';};","panel.querySelector('.hc290PhotoStatus').textContent=p?'Foto lista.':'Sin foto seleccionada.';window.HC292OCR?.attach(panel,p,()=>scheduleRead());};");
portal=replace(portal,"const canvas=await identityCanvas(snapshot[side].file,true);if(!live(job))return;","snapshot[side].file.__hc292Rotation=snapshot[side].ocrRotation||0;const canvas=await identityCanvas(snapshot[side].file,true);if(!live(job)){canvas.width=canvas.height=1;return;}");
const start=portal.indexOf("        if(side==='front'&&(!parsed.name||!parsed.dni||!parsed.dob)){");
const end=portal.indexOf('        canvas.width=canvas.height=1;',start);
if(start<0||end<0)throw Error('Missing OCR pass anchors');
portal=portal.slice(0,start)+`        const weak=side==='front'&&(!parsed.name||!parsed.dni||!parsed.dob||Number(result.data?.confidence??100)<72);
        if(window.HC292OCR&&(weak||snapshot[side].ocrCrop)){
          ocrStatus.textContent='Mejorando contraste y letras pequeñas del '+(side==='front'?'frente':'dorso')+'…';
          const crop=snapshot[side].ocrCrop?window.HC292OCR.region(canvas,snapshot[side].ocrCrop):null;
          const enhanced=window.HC292OCR.enhance(crop||canvas);if(crop)crop.width=crop.height=1;
          await localWorker.setParameters({tessedit_pageseg_mode:'11'});if(!live(job)){enhanced.width=enhanced.height=1;canvas.width=canvas.height=1;return;}
          try{result=await deadline(localWorker.recognize(enhanced,{rotateAuto:true}),45000,'No pude completar la lectura de letras pequeñas. Revisá los datos y completá lo que falta.');if(!live(job))return;readings[side]+='\\n'+(result.data?.text||'');applyRead();}
          finally{enhanced.width=enhanced.height=1;}
          await localWorker.setParameters({tessedit_pageseg_mode:'3'});
        }
`+portal.slice(end);
portal=replace(portal,"async function newBooking(){main().dataset.view='booking';","async function newBooking(legacy=false){if(!legacy&&window.hc292Search)return window.hc292Search();main().dataset.view='booking';");
portal=replace(portal,'<input id="hc289Specialty" list="hc289Specialties" placeholder="Buscar especialidad" autocomplete="off"><datalist id="hc289Specialties"></datalist>','<select id="hc289Specialty"><option value="">Todas las especialidades</option></select>');
portal=replace(portal,"q('#hc289Role').onchange=e=>{bookingUI.role=e.target.value;resetProvider();renderLists();};","q('#hc289Role').onchange=e=>{bookingUI.role=e.target.value;bookingUI.specialty='';q('#hc289Specialty').innerHTML='<option value=\"\">Todas las especialidades</option>'+(window.hc292SpecialtyOptions?.(bookingUI.role,directory.providers.filter(p=>p.role===bookingUI.role).map(p=>p.specialty))||'');resetProvider();renderLists();};");
portal=replace(portal,"q('#hc289Specialty').oninput=","q('#hc289Specialty').onchange=");
portal=replace(portal,"q('#hc289Specialties').innerHTML=[...new Set(directory.providers.map(p=>p.specialty).filter(Boolean))].map(s=>'<option value=\"'+E(s)+'\">').join('');","q('#hc289Specialty').innerHTML='<option value=\"\">Todas las especialidades</option>'+(window.hc292SpecialtyOptions?.(bookingUI.role,directory.providers.filter(p=>p.role===bookingUI.role).map(p=>p.specialty))||'');");
portal=replace(portal,'function resetProvider(){','window.hc292InstitutionBooking=()=>newBooking(true);\nfunction resetProvider(){');
write('ui/v292-portal.js',portal+'\n');
let html=read('Hospitalito_v291.html');html=replace(html,read('ui/v291-portal.js').trim(),portal);
html=replace(html,'function serviceList(){return ROLE_SERVICES[String(session?.role||"")]||["UTI","UCO","UCE","Clínica médica","Guardia Central","Consultorios","Otro servicio"];}','function serviceList(){const base=ROLE_SERVICES[String(session?.role||"")]||["UTI","UCO","UCE","Clínica médica","Guardia Central","Consultorios","Otro servicio"];return ["medico","enfermero","kinesiologo","nutricionista","bioquimico","microbiologo","imagenologo","hemoterapia"].includes(String(session?.role||""))?Array.from(new Set([...base,"Telemedicina"])):base;}');
html=html.replaceAll('v291 ·','v292 ·').replace("window.HC_DEMO_VERSION='v290'","window.HC_DEMO_VERSION='v292'").replace("VERSION='v291'","VERSION='v292'");
const scripts=['v292-ocr.js','v292-marketplace.js','v292-video.js'].map(p=>'<script id="hc-'+p.replace('.js','')+'">\n'+read('ui/'+p)+'\n</script>').join('\n');
html=html.slice(0,html.lastIndexOf('</body>'))+('<style id="hc-v292-styles">\n'+read('ui/v292.css')+'\n.hc292OCRAdjust canvas{display:block;width:100%;height:auto;touch-action:none;cursor:crosshair;border:1px solid var(--hc-theme-line);margin-top:12px}.hc292OCRAdjust canvas[hidden]{display:none}.hc292OCRAdjust button{margin:4px}\n</style>\n'+scripts+'\n</body>')+html.slice(html.lastIndexOf('</body>')+7);
let count=0;for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc\s*=|application\/(?:json|ld\+json)/.test(m[1]))continue;new vm.Script(m[2],{filename:'inline-'+(++count)+'.js'});}
write('index.html',html);write('Hospitalito_v292.html',html);write('service-worker.js',read('service-worker.js').replace(/hospitalito-v\d+-shell/g,'hospitalito-v292-shell'));
const release={version:'v292',bytes:Buffer.byteLength(html),sha256:crypto.createHash('sha256').update(html).digest('hex'),checks:['inline-script-syntax-'+count],payments:'disabled_pending_owner_configuration'};write('release-v292.json',JSON.stringify(release,null,2)+'\n');console.log(JSON.stringify(release));
