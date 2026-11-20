const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),file=path.join(root,'index.html');let html=fs.readFileSync(file,'utf8');
if(!html.includes('id="hc-v306-ui"')){for(const c of require('./v306-patch.json')){const n=html.split(c.before).length-1;if(!n||(!c.all&&n!==1))throw Error('Source mismatch: '+c.before.slice(0,80));html=c.all?html.split(c.before).join(c.after):html.replace(c.before,()=>c.after);}const tail='\n<style id="hc-v306-styles">\n'+fs.readFileSync(path.join(root,'ui/v306.css'),'utf8')+'\n</style>\n<script id="hc-v306-ui">\n'+fs.readFileSync(path.join(root,'ui/v306.js'),'utf8')+'\n</script>\n';const i=html.lastIndexOf('</body>');html=html.slice(0,i)+tail+html.slice(i);fs.writeFileSync(file,html);}
fs.writeFileSync(path.join(root,'Hospitalito_v306.html'),html);
const sw=path.join(root,'service-worker.js');fs.writeFileSync(sw,fs.readFileSync(sw,'utf8').replace('hospitalito-v305-shell','hospitalito-v306-shell'));
console.log('Hospitalito v306 built');
