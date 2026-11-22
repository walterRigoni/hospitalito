"""Build v316 from the standalone v315 release."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / "Hospitalito_v315.html").read_text(encoding="utf-8")


def change(old, new):
    global page
    count = page.count(old)
    if count != 1:
        raise ValueError(f"Expected one v315 match, found {count}: {old[:140]}")
    page = page.replace(old, new)


for old in (
    "CURRENT_VERSION = 315;",
    "<title>Hospitalito v315",
    'window.HC_DEMO_VERSION="v315";document.title="Hospitalito · Historia Clínica Digital · v315";',
    '<span id="hc307Version">v315</span>',
    '>Hospitalito <small>v315</small>',
):
    change(old, old.replace("315", "316"))

change("async function identityCanvas(file,ocr=false){", "async function identityCanvas(file,ocr=false,turns=0){")
change("return ocr&&window.HC292OCR?window.HC292OCR.rotate(canvas,file.__hc292Rotation||0):canvas;",
       "return window.HC292OCR.rotate(canvas,turns);")
change("snapshot[side].file.__hc292Rotation=snapshot[side].ocrRotation||0;const canvas=await identityCanvas(snapshot[side].file,true);",
       "const canvas=await identityCanvas(snapshot[side].file,true,snapshot[side].ocrRotation);")
change("const canvas=await identityCanvas(snapshot[side].file);",
       "const canvas=await identityCanvas(snapshot[side].file,false,snapshot[side].ocrRotation);")

deadline = "const deadline=(promise,ms,message)=>new Promise((resolve,reject)=>{const id=setTimeout(()=>reject(Error(message)),ms);Promise.resolve(promise).then(v=>{clearTimeout(id);resolve(v);},e=>{clearTimeout(id);reject(e);});});"
change("  " + deadline + "\n", "")
worker = """T.createWorker('spa',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',logger:m=>{if(live(job)&&m.status==='recognizing text'){progress.value=Math.round(m.progress*100);}}})"""
change(worker, """createDniWorker(T,m=>{if(live(job)&&m.status==='recognizing text')progress.value=Math.round(m.progress*100);})""")
change("function identityImage(file){", deadline + """
function createDniWorker(T,logger){
  return T.createWorker('spa',1,{
    workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
    corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',logger
  });
}
function readDniOrientation(worker,canvas,isCurrent){
  return window.HC316Dni.readDirection(canvas,
    candidate=>deadline(worker.recognize(candidate,{rotateAuto:false}),25000,'No pude detectar la orientación del DNI.'),
    isCurrent);
}
function identityImage(file){""")

change("""function identityGallery(result){""", """function initialDniTurns(img){
  return img.naturalHeight>img.naturalWidth?1:0;
}
function flipDni(turns){return (Number(turns)+2)%4;}
async function orientSavedDocuments(gallery){
  const cards=await Promise.all([...gallery.querySelectorAll('.hc290SavedDocument')].map(async card=>{
    const frame=card.querySelector('.hc316DniFrame'),img=frame.querySelector('img'),button=card.querySelector('[data-dni-rotate]');
    let manual=false;
    const isCurrent=()=>frame.isConnected&&!manual;
    try{await img.decode();}catch{return null;}
    if(!frame.isConnected)return null;
    const turns=initialDniTurns(img);
    frame.dataset.dniTurns=turns;
    button.disabled=false;
    button.onclick=()=>{manual=true;frame.dataset.dniTurns=(Number(frame.dataset.dniTurns)+1)%4;};
    return {frame,img,turns,isCurrent};
  }));
  const readable=cards.filter(Boolean);
  const hasImage=()=>readable.some(card=>card.isCurrent());
  if(!hasImage())return;
  let worker,expired=false;
  try{
    const T=await loadOCR();
    if(!hasImage())return;
    const creating=createDniWorker(T,()=>{});
    creating.then(w=>{if(expired)w.terminate().catch(()=>{});}).catch(()=>{});
    worker=await deadline(creating,25000,'No pude iniciar la lectura del DNI.');
    await worker.setParameters({tessedit_pageseg_mode:'3'});
    for(const {frame,img,turns,isCurrent} of readable){
      if(!isCurrent())continue;
      let canvas=document.createElement('canvas');
      const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      try{
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        canvas=window.HC292OCR.rotate(canvas,turns);
        const direction=await readDniOrientation(worker,canvas,isCurrent);
        if(direction?.flip&&isCurrent())frame.dataset.dniTurns=flipDni(turns);
      }finally{canvas.width=canvas.height=1;}
    }
  }catch{
    // The gallery already shows each photo and offers manual rotation.
  }finally{
    expired=true;
    if(worker)worker.terminate().catch(()=>{});
  }
}
function identityGallery(result){""")
change("""+'</figcaption><a href="'+image(d.data)+'" download="dni-'""",
       """+'</figcaption><a class="hc316DniFrame" href="'+image(d.data)+'" download="dni-'""")
change("""+(d.side==='back'?'Dorso':'Frente')+' del DNI"></a></figure>').join('');""",
       """+(d.side==='back'?'Dorso':'Frente')+' del DNI"></a><button type="button" data-dni-rotate disabled aria-label="Girar '+(d.side==='back'?'dorso':'frente')+' del DNI 90°">Girar foto</button></figure>').join('');""")
change("window.hc290IdentityGallery=identityGallery;", """function renderDniGallery(gallery,result){
  gallery.innerHTML=identityGallery(result);
  orientSavedDocuments(gallery);
}
window.hc290IdentityGallery=identityGallery;
window.hc316RenderDniGallery=renderDniGallery;""")
change("gallery.innerHTML=identityGallery(j);", "renderDniGallery(gallery,j);")
change("box.innerHTML=window.hc290IdentityGallery(j);", "window.hc316RenderDniGallery(box,j);")

change("Que se vea completo, con buena luz y sin reflejos.", "Poné el DNI en horizontal, con buena luz y sin reflejos.")
change('<div class="hc290PhotoPreview" hidden>', '<div class="hc290PhotoPreview hc316DniFrame" hidden>')
change('<button type="button" data-remove-document hidden>Eliminar foto</button>',
       """<button type="button" data-dni-rotate hidden aria-label="Girar '+face+' del DNI 90°">Girar foto</button><button type="button" data-remove-document hidden>Eliminar foto</button>""")
change("preview.hidden=!p;if(p)preview.querySelector('img').src=p.url;",
       "preview.hidden=!p;preview.dataset.dniTurns=p?.ocrRotation||0;if(p)preview.querySelector('img').src=p.url;")
change("panel.querySelector('[data-remove-document]').hidden=!p;",
       "panel.querySelector('[data-remove-document]').hidden=!p;panel.querySelector('[data-dni-rotate]').hidden=!p;")
change("window.HC292OCR?.attach(panel,p,()=>scheduleRead());", "window.HC292OCR.attach(panel,p,()=>{stop();scheduleRead();});")
change("photos[side]={file:f,url:decoded.url};", "photos[side]={file:f,url:decoded.url,ocrRotation:initialDniTurns(decoded.img)};")

change("""        const canvas=await identityCanvas(snapshot[side].file,true,snapshot[side].ocrRotation);if(!live(job)){canvas.width=canvas.height=1;return;}
        let result=await deadline(localWorker.recognize(canvas,{rotateAuto:true}),45000,'La lectura está tardando demasiado. Reintentá con una foto más clara o escribí los datos a mano.');""",
       """        const photo=snapshot[side],isCurrent=()=>live(job);
        let canvas=await identityCanvas(photo.file,true,photo.ocrRotation);
        if(!isCurrent()){canvas.width=canvas.height=1;return;}
        let result;
        if(!photo.orientationChecked&&!photo.ocrCrop){
          const direction=await readDniOrientation(localWorker,canvas,isCurrent);
          if(!direction){canvas.width=canvas.height=1;return;}
          photo.orientationChecked=true;
          if(direction.flip){
            photo.ocrRotation=flipDni(photo.ocrRotation);
            const panel=el.querySelector('[data-document-side="'+side+'"]');
            updatePanel(side);
            panel.querySelector('[data-crop-canvas]').hidden=true;
            canvas=window.HC292OCR.rotate(canvas,2);
          }
          result=direction.result;
        }else{
          result=await deadline(localWorker.recognize(canvas,{rotateAuto:true}),45000,'La lectura está tardando demasiado. Reintentá con una foto más clara o escribí los datos a mano.');
        }""")

change('<button type="button" data-crop-rotate>Girar lectura 90°</button>', '')
change("""const selected=details._photo;try{source=rotate(await imageCanvas(selected.file),selected.ocrRotation);if(selected!==details._photo||!details.isConnected){source.width=source.height=1;return;}canvas.width=source.width;""",
       """const selected=details._photo,rotation=selected.ocrRotation;try{const prepared=rotate(await imageCanvas(selected.file),rotation);if(selected!==details._photo||rotation!==selected.ocrRotation||!details.isConnected){prepared.width=prepared.height=1;return;}source=prepared;canvas.width=source.width;""")
change("""details.querySelector('[data-crop-rotate]').onclick=()=>{photo.ocrRotation=((photo.ocrRotation||0)+1)%4;photo.ocrCrop=null;source=null;canvas.hidden=true;status.textContent='Lectura girada '+photo.ocrRotation*90+'°. La foto original se conserva.';read();};""",
       """panel.querySelector('[data-dni-rotate]').onclick=()=>{
  photo.ocrRotation=(photo.ocrRotation+1)%4;
  photo.orientationChecked=true;
  panel.querySelector('.hc290PhotoPreview').dataset.dniTurns=photo.ocrRotation;
  photo.ocrCrop=null;source=null;start=null;selection=null;canvas.hidden=true;
  panel.querySelector('.hc290PhotoStatus').textContent='Foto lista. Vista girada '+photo.ocrRotation*90+'°.';
  status.textContent='';
  read();
};""")

style = (root / "ui/v316.css").read_text(encoding="utf-8")
script = (root / "ui/v316-dni.js").read_text(encoding="utf-8")
change("</body>\n</html>", f'<style id="hc-v316-dni">\n{style}</style>\n<script id="hc-v316-orientation">\n{script}</script>\n</body>\n</html>')
for filename in ("index.html", "Hospitalito_v316.html"):
    (root / filename).write_text(page, encoding="utf-8")
