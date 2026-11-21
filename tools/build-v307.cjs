const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),file=path.join(root,'index.html');
let html=fs.readFileSync(file,'utf8');
function replace(before,after){const n=html.split(before).length-1;if(n!==1)throw Error('Expected one match, got '+n+': '+before.slice(0,80));html=html.replace(before,()=>after);}
if(!html.includes('id="hc-v307-ui"')){
 replace('const CURRENT_VERSION = 306;','const CURRENT_VERSION = 307;');
 replace('<title>Hospitalito v306 · Registro de pacientes · Supabase</title>','<title>Hospitalito v307 · Historia Clínica Digital</title>');
 replace('<div style="font-weight:1000;">Historia Clínica</div>','<div style="font-weight:1000;">Historia Clínica <span id="hc307Version">v307</span></div>');
 replace('<small class="hc305Version">v306</small>','<small class="hc305Version">v307</small>');
 replace('    const tableWrap = document.createElement("div");\n    tableWrap.style.cssText', '    const tableWrap = document.createElement("div");\n    tableWrap.className = "hc307BalanceScroll";\n    tableWrap.tabIndex = 0;\n    tableWrap.setAttribute("role", "region");\n    tableWrap.setAttribute("aria-label", "Registros de balance del " + dmyFromDateISO(dayKey));\n    tableWrap.style.cssText');
 replace('<div id="balList" style="margin-top:8px;"></div>','<p class="hc307BalanceHelp">Deslizá la tabla para ver todas las columnas, incluido Balance acumulado.</p>\n      <div id="balList" style="margin-top:8px;"></div>');
 const tail='\n<style id="hc-v307-styles">\n'+fs.readFileSync(path.join(root,'ui/v307.css'),'utf8')+'\n</style>\n<script id="hc-v307-ui">\nwindow.HC_DEMO_VERSION="v307";document.title="Hospitalito · Historia Clínica Digital · v307";\n</script>\n';
 const i=html.lastIndexOf('</body>');if(i<0)throw Error('Missing body');html=html.slice(0,i)+tail+html.slice(i);
 fs.writeFileSync(file,html);
}
fs.writeFileSync(path.join(root,'Hospitalito_v307.html'),html);
const sw=path.join(root,'service-worker.js');fs.writeFileSync(sw,fs.readFileSync(sw,'utf8').replace('hospitalito-v306-shell','hospitalito-v307-shell'));
console.log('Hospitalito v307 built');
