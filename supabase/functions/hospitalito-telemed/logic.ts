export const roles=['medico','enfermero','kinesiologo','nutricionista','bioquimico','microbiologo','imagenologo','hemoterapia'];
export const str=(v:unknown,n=500)=>String(v??'').trim().slice(0,n);
export function integer(v:unknown,min:number,max:number){const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Número fuera del rango permitido');return n;}
export function split(amount:number,bps:number){integer(amount,100,100000000);integer(bps,1,9999);const platform=Math.round(amount*bps/10000);if(platform<1||platform>=amount)throw Error('Comisión incompatible con el precio');return {amount_cents:amount,platform_cents:platform,provider_cents:amount-platform};}
export function weekly(raw:any,address=''){
 const days:any={};const time=/^([01]\d|2[0-3]):[0-5]\d$/;
 for(let i=0;i<7;i++){
  const d=raw?.days?.[i]||{},active=d.active===true;
  let windows=(Array.isArray(d.windows)?d.windows:[{start:d.start||'08:00',end:d.end||'12:00',address}]).map((w:any)=>({start:str(w.start,5),end:str(w.end,5),address:str(w.address||address,500),location:str(w.location,160)}));
  if(windows.length>8)throw Error('Máximo ocho bloques por día');
  for(const w of windows)if(!time.test(w.start)||!time.test(w.end)||w.start>=w.end)throw Error('Revisá el inicio y el fin de cada bloque');
  windows.sort((a:any,b:any)=>a.start.localeCompare(b.start));
  for(let n=1;n<windows.length;n++)if(windows[n].start<windows[n-1].end)throw Error('Hay bloques superpuestos en el mismo día');
  if(active&&!windows.length)throw Error('Agregá un bloque al día seleccionado');
  days[i]={active,start:windows[0]?.start||'08:00',end:windows.at(-1)?.end||'12:00',windows};
 }return {days};
}
export function cleanProfile(p:any,role:string){
 if(!roles.includes(role))throw Error('Se requiere un profesional habilitado');const modes:any={};
 for(const mode of ['telemedicine','office']){
  const m=p?.modes?.[mode]||{},rates=(Array.isArray(m.rates)?m.rates:[]).map((r:any)=>({minutes:integer(r.minutes,15,60),amount_cents:integer(r.amount_cents,100,100000000)}));
  if(rates.some((r:any)=>![15,30,45,60].includes(r.minutes))||new Set(rates.map((r:any)=>r.minutes)).size!==rates.length)throw Error('Duraciones o precios repetidos');
  const schedule=weekly(m.weekly,mode==='office'?str(p.address,500):'');
  if(m.enabled===true&&(!rates.length||!Object.values(schedule.days).some((d:any)=>d.active)))throw Error('Indicá un precio y al menos un día para cada modalidad activa');
  if(mode==='office'&&m.enabled===true&&Object.values(schedule.days).some((d:any)=>d.active&&d.windows.some((w:any)=>!w.address)))throw Error('Completá la ubicación de cada bloque del consultorio privado');
  modes[mode]={enabled:m.enabled===true,rates,weekly:schedule};
 }
 const bank=p.bank_public||{},cbu=str(bank.cbu,22);if(cbu&&!/^\d{22}$/.test(cbu))throw Error('El CBU/CVU debe tener 22 dígitos');
 const out={role,specialty:str(p.specialty,150),display_name:str(p.display_name,200),description:str(p.description,2000),credential:str(p.credential,160),address:str(p.address,500),public_visible:p.public_visible===true,modes,bank_public:{visible:bank.visible===true,holder:str(bank.holder,160),bank:str(bank.bank,120),alias:str(bank.alias,100),cbu}};
 if(!out.specialty||!out.credential)throw Error('Completá especialidad y matrícula');
 if(out.public_visible&&!Object.values(modes).some((m:any)=>m.enabled))throw Error('Habilitá una modalidad de atención');return out;
}
export function validCheckout(url:unknown){return /^https:\/\/(?:www\.|sandbox\.)?mercadopago\.com\.ar\//.test(String(url||''));}
export const normalize=(s:unknown)=>str(s,200).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();


