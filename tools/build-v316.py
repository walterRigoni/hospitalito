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

change("""function identityGallery(result){""", """function initialDniTurns(img){
  return img.naturalHeight>img.naturalWidth?1:0;
}
function orientSavedDocuments(gallery){
  for(const card of gallery.querySelectorAll('.hc290SavedDocument')){
    const frame=card.querySelector('.hc316DniFrame'),img=frame.querySelector('img'),button=card.querySelector('[data-dni-rotate]');
    const initialize=()=>{
      if(!img.naturalWidth)return;
      frame.dataset.dniTurns=initialDniTurns(img);
      button.disabled=false;
    };
    if(img.complete)initialize();
    else img.addEventListener('load',initialize,{once:true});
    button.onclick=()=>{frame.dataset.dniTurns=(Number(frame.dataset.dniTurns)+1)%4;};
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

change('<button type="button" data-crop-rotate>Girar lectura 90°</button>', '')
change("""const selected=details._photo;try{source=rotate(await imageCanvas(selected.file),selected.ocrRotation);if(selected!==details._photo||!details.isConnected){source.width=source.height=1;return;}canvas.width=source.width;""",
       """const selected=details._photo,rotation=selected.ocrRotation;try{const prepared=rotate(await imageCanvas(selected.file),rotation);if(selected!==details._photo||rotation!==selected.ocrRotation||!details.isConnected){prepared.width=prepared.height=1;return;}source=prepared;canvas.width=source.width;""")
change("""details.querySelector('[data-crop-rotate]').onclick=()=>{photo.ocrRotation=((photo.ocrRotation||0)+1)%4;photo.ocrCrop=null;source=null;canvas.hidden=true;status.textContent='Lectura girada '+photo.ocrRotation*90+'°. La foto original se conserva.';read();};""",
       """panel.querySelector('[data-dni-rotate]').onclick=()=>{
  photo.ocrRotation=(photo.ocrRotation+1)%4;
  panel.querySelector('.hc290PhotoPreview').dataset.dniTurns=photo.ocrRotation;
  photo.ocrCrop=null;source=null;start=null;selection=null;canvas.hidden=true;
  panel.querySelector('.hc290PhotoStatus').textContent='Foto lista. Vista girada '+photo.ocrRotation*90+'°.';
  status.textContent='';
  read();
};""")

style = (root / "ui/v316.css").read_text(encoding="utf-8")
change("</body>\n</html>", f'<style id="hc-v316-dni">\n{style}</style>\n</body>\n</html>')
for filename in ("index.html", "Hospitalito_v316.html"):
    (root / filename).write_text(page, encoding="utf-8")
