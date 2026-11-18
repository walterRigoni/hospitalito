from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
s=Path('Hospitalito_v296.html').read_text()
def rep(a,b):
 global s
 assert a in s,a[:100]
 s=s.replace(a,b)
rep('Hospitalito v296','Hospitalito v297');rep("HC_DEMO_VERSION='v296'", "HC_DEMO_VERSION='v297'");rep('HC Demo v296','HC Demo v297')
# Make the workspace choice available even with one institution or without institutional memberships.
s=s.replace('if(!institutions.length)throw', 'if(!institutions.length&&!window.hc297IsProfessional?.(a.user))throw')
s=s.replace('if(institutions.length===1){await hcGlobalEnterInstitution', 'if(institutions.length===1&&!window.hc297IsProfessional?.(a.user)){await hcGlobalEnterInstitution')
s=s.replace('if(institutions.length===1){await enterFast', 'if(institutions.length===1&&!window.hc297IsProfessional?.(a.user)){await enterFast')
s=s.replace('if(a.institutions.length===1)return await hcGlobalEnterInstitution', 'if(a.institutions.length===1&&!window.hc297IsProfessional?.(a.user))return await hcGlobalEnterInstitution')
# Explicit institutional telemedicine buttons keep using the existing institution-scoped Portal agenda.
rep("b.textContent='✎ Telemedicina / Consultorio · editar días, horarios y tarifas';b.onclick=()=>window.hc292Professional();", "b.textContent='Telemedicina de esta institución';b.onclick=()=>window.hc297InstitutionTele();")
rep("b.textContent='Telemedicina';b.onclick=()=>window.hc292Professional();", "b.textContent='Telemedicina institucional';b.onclick=()=>window.hc297InstitutionTele();")
# Compact green results: validate at least one free slot for the chosen day before listing.
a=s.index(" const render=()=>{q('#hc292Provider').innerHTML='';",s.index('window.hc292Search='));b=s.index(' f.elements.role.onchange=',a)
s=s[:a]+''' let renderVersion=0;
 const render=async()=>{const version=++renderVersion;q('#hc292Provider').innerHTML='';const role=f.elements.role.value,mode=f.elements.mode.value,date=f.elements.date.value,day=new Date(date+'T12:00Z').getUTCDay(),specialty=fold(f.elements.specialty.value);
 const candidates=directory.providers.filter(p=>p.role===role&&(!specialty||fold(p.specialty)===specialty)&&p.modes[mode]?.enabled&&p.modes[mode].weekly.days[day]?.active);q('#hc292Status').textContent='Comprobando horarios disponibles…';q('#hc292Directory').innerHTML='';
 const found=[];for(let offset=0;offset<candidates.length;offset+=50){const group=candidates.slice(offset,offset+50);try{const batch=await api('availability',{providers:group.map(p=>p.username),mode,date});for(const entry of batch.providers){const p=group.find(p=>p.username===entry.id);if(entry.failed)found.push({failed:true});else if(entry.available&&p)found.push(p);}}catch{found.push({failed:true});}}
 if(version!==renderVersion||seq!==searchSerial||!f.isConnected)return;const providers=found.filter(p=>p&&!p.failed).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 q('#hc292Status').textContent=found.some(p=>p?.failed)?'No se pudo comprobar toda la disponibilidad. Volvé a intentar.':'Profesionales con horarios disponibles para el día elegido.';
 q('#hc292Directory').innerHTML=providers.map(p=>'<button type="button" class="hc297Available" data-tele-profile="'+E(p.username)+'"><span><b>'+E(p.name)+'</b><small>'+E(p.specialty)+'</small></span><span>'+E(p.trialAvailable?'Gratis · $0':'Desde '+money(Math.min(...p.modes[mode].rates.map(r=>r.amount_cents))))+' · Ver disponibilidad ›</span></button>').join('')||'<p>No hay horarios disponibles para esa modalidad y día. Probá otra fecha.</p>';
 q('#hc292Directory').querySelectorAll('[data-tele-profile]').forEach(b=>b.onclick=()=>detail(directory.providers.find(p=>p.username===b.dataset.teleProfile),mode,date));};
''' +s[b:]
rep("<option value=\"office\">Consultorio particular</option>","<option value=\"office\">Consultorio Privado</option>")
rep("expectedTrial:trial,acceptPolicy:","expectedTrial:trial,bookingProtocol:297,acceptPolicy:")
rep("entries.filter(([_,id])=>!client||!['shift','members','institutions','license'].includes(id))","entries.filter(([_,id])=>(id!=='private-workspaces'||(!client&&window.hc297IsProfessional?.(U())))&&(!client||!['shift','members','institutions','license'].includes(id)))")
# Detail includes all available locations; each slot carries its own server-issued address.
rep("E(mode==='office'?p.address:'Atención por videollamada privada')", "E(mode==='office'?'Elegí el horario y la ubicación del consultorio.':'Atención por videollamada privada')")
rep("<p>'+E(p.description)+'</p><p>'+E(mode===", "<p>'+E(p.description)+'</p>'+window.hc297BankInfo(p)+'<p>'+E(mode===")
old="mode==='office'?(fee==null?'El anticipo de Hospitalito se mostrará cuando se defina la comisión.':'Pagás ahora '+money(fee)+' a Hospitalito. Después de la atención abonás '+money(r.amount_cents-fee)+' al profesional. Total: '+money(r.amount_cents)+'.'):"
rep(old,"mode==='office'?'Total a pagar al reservar: '+money(r.amount_cents)+'. El pago se distribuye automáticamente entre el profesional y Hospitalito según el porcentaje configurado.':")
rep("E(s.local.slice(-5))+(!s.available?' · ocupado':'')", "E(s.local.slice(-5))+(s.address?'<br><small>'+E(s.location||'Consultorio')+' · '+E(s.address)+'</small>':'')+(!s.available?' · ocupado':'')")
rep("selected=j.slots[Number(b.dataset.teleSlot)];q('#hc292Slots')", "selected=j.slots[Number(b.dataset.teleSlot)];status.textContent=selected.address?'Ubicación elegida: '+selected.address:'';q('#hc292Slots')")
rep("<p>'+E(v.reason)+'</p><p>'", "<p>'+E(v.reason)+'</p>'+(v.location_snapshot?'<p><b>Consultorio:</b> '+E(v.location_snapshot)+'</p>':'')+'<p>'")
rep("v.mode==='office'?'Anticipo Hospitalito:", "v.mode==='office'&&v.payment_model==='split_full'?'Pago total: '+money(v.total_cents)+'. Comisión Hospitalito: '+money(v.platform_cents)+'. Profesional: '+money(v.provider_cents)+'.':v.mode==='office'?'Anticipo Hospitalito:")
rep("+(client?'<button id=\"hc292Reconcile\">", "+(client&&!v.is_trial?'<button id=\"hc292Reconcile\">")
rep("E(typeof getCurrentUser==='function'?getCurrentUser()?.name:session?.name)","E(window.hc297CurrentProfessionalName?.()||session?.name||'')")
# Document preparation/publication available for confirmed outpatient care as well as active video visits.
s=s.replace("visit.side==='provider'&&['active','finished'].includes(visit.visit.status)", "visit.side==='provider'&&['confirmed','active','finished'].includes(visit.visit.status)")
rep("visit=await api('visit',{visitId:id});find('[data-doc-refresh]')", "visit=await api('visit',{visitId:id});if(visit.side==='provider'){root.classList.add('hc297CallWithNotes');window.hc297MountClinical(root,id).catch(e=>status.textContent=e.message);}find('[data-doc-refresh]')")
# Replace deprecated combined professional settings with the independent workspace form loaded below.
a=s.index('window.hc292Professional=async function()');b=s.index('window.hc292Admin=async function()',a)
s=s[:a]+s[b:]
# Add workspaces to account menu for professionals already inside an institution.
rep("const entries=[['Perfil','account']", "const entries=[['Mis ámbitos','private-workspaces'],['Perfil','account']")
# Account navigation dispatcher uses settings action. Hook click before it reaches the old menu handler.
js=Path('ui/private-workspaces.js').read_text()
css=Path('ui/private-workspaces.css').read_text()
s=s.rsplit('</body>',1)[0]+'<style id="hc-v297-workspace-styles">'+css+'</style>\n<script id="hc-v297-workspaces">'+js+'</script>\n</body>'+s.rsplit('</body>',1)[1]
Path('Hospitalito_v297.html').write_text(s)
