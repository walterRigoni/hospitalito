const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.dirname(__dirname),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const original=read('Hospitalito_v290.html'),oldPortal=read('ui/v290-portal.js').trim(),portal=read('ui/v291-portal.js').trim();
if(original.split(oldPortal).length!==2)throw Error('Expected one v290 portal script');
const css=read('ui/v291.css'),extra=css.slice(css.indexOf('.hc291Camera{'),css.indexOf('.hc290Registration [aria-busy=true]'));
if(!extra.startsWith('.hc291Camera{'))throw Error('Missing camera styles');
const html=original.replace(oldPortal,()=>portal).replaceAll('v290 ·','v291 ·').replace("VERSION='v290'","VERSION='v291'").replace('</head>','<style id="hc291CameraStyles">\n'+extra+'</style>\n</head>');
let scripts=0;for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc\s*=/.test(match[1])||/application\/(?:json|ld\+json)/.test(match[1]))continue;new vm.Script(match[2],{filename:'inline-'+(++scripts)+'.js'});}
fs.writeFileSync(path.join(root,'index.html'),html);fs.writeFileSync(path.join(root,'Hospitalito_v291.html'),html);
const sw=read('service-worker.js').replace('hospitalito-v290-shell','hospitalito-v291-shell');fs.writeFileSync(path.join(root,'service-worker.js'),sw);
const release={version:'v291',sha256:crypto.createHash('sha256').update(html).digest('hex'),bytes:Buffer.byteLength(html),baseSha256:crypto.createHash('sha256').update(original).digest('hex'),checks:['inline-script-syntax-'+scripts]};
fs.writeFileSync(path.join(root,'release-v291.json'),JSON.stringify(release,null,2)+'\n');console.log(JSON.stringify(release));
