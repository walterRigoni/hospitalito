"""Apply the patient and professional workflow corrections to the v308 release."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / "Hospitalito_v308.html").read_text()


def replace(old, new):
    global page
    if page.count(old) != 1:
        raise ValueError("Expected one v308 anchor: " + old[:100])
    page = page.replace(old, new, 1)


replace('<title>Hospitalito v308', '<title>Hospitalito v309')
replace('const CURRENT_VERSION = 308;', 'const CURRENT_VERSION = 309;')
replace('window.HC_DEMO_VERSION="v308";document.title="Hospitalito · Historia Clínica Digital · v308";',
        'window.HC_DEMO_VERSION="v309";document.title="Hospitalito · Historia Clínica Digital · v309";')
replace('<small class="hc305Version">v308</small>', '<small class="hc305Version">v309</small>')
replace('<span id="hc307Version">v308</span>', '<span id="hc307Version">v309</span>')

# Keep the camera, OCR, and original fields alive when moving through registration.
replace("  const stopTracks=stream=>", """  const registration=window.HC309.registration(el,form,() => {
    if(photoBusy.front||photoBusy.back)return 'Esperá a que termine de cargar la foto.';
    if(!photos.front)return 'Agregá una foto del frente del DNI.';
    if(!photos.back)return 'Agregá una foto del dorso del DNI.';
    return '';
  },() => closeCamera(),registrationUsername);
  const stopTracks=stream=>""")
replace("if(!form.reportValidity()){status.textContent='Revisá los campos señalados antes de continuar.';return;}",
        "if(!registration.validateAll()){status.textContent='Revisá los campos señalados antes de continuar.';return;}")
replace("el.querySelector('[data-document-side=\"'+side+'\"] .hc290Choose').scrollIntoView",
        "registration.show(1);el.querySelector('[data-document-side=\"'+side+'\"] .hc290Choose').scrollIntoView")
replace("user.disabled=false;user.focus();", "registration.show(0);user.disabled=false;user.focus();")

# Give all three places of care the same entry point.
start = page.index(" root.innerHTML='<button data-289-back>‹ Mi calendario</button><h2>Encontrá tu profesional")
end = page.index("\n const f=q('#hc292SearchForm')", start)
old = page[start:end]
new = old
intro_start = new.index("<button data-289-back")
intro_end = new.index("<form")
new = new[:intro_start] + """<h2>Nuevo turno</h2><div class="hc309CareChoices" role="group" aria-label="Lugar de atención"><button type="button" data-care-mode="telemedicine"><b>Telemedicina</b><small>Atención por videollamada</small></button><button type="button" data-care-mode="office"><b>Consultorio Privado</b><small>Atención presencial</small></button><button type="button" id="hc292InstitutionSearch"><b>Instituciones</b><small>Turnos de tu institución</small></button></div>""" + new[intro_end:]
new = new.replace('<label>Atención<select name="mode">','<label hidden>Atención<select name="mode">')
a = new.index('</form><p>')
b = new.index('<div class="hc299LocateBar">',a)
new = new[:a] + '</form>' + new[b:]
new = new.replace('title="Usar mi ubicación para buscar consultorios cercanos">⌖ Mi ubicación', 'title="Usar mi ubicación para buscar consultorios cercanos">Usar mi ubicación')
new = new.replace('<p id="hc292Status" role="status">Cargando agendas…</p>', '<p id="hc292Status" role="status">Cargando agendas…</p><button type="button" id="hc309TrySearch" hidden>Reintentar búsqueda</button>')
replace(old,new)
replace("let directory={providers:[],paymentsReady:false},patientPosition=null;",
        "let directory={providers:[],paymentsReady:false},patientPosition=null,directoryReady=false;")
replace("f.elements.specialty.value=old;}\n let renderVersion", "f.elements.specialty.value=[...f.elements.specialty.options].some(o=>o.value===old)?old:'';}\n let renderVersion")
replace("const version=++renderVersion;updateSteps(1);q('#hc292Provider').innerHTML='';",
        """const version=++renderVersion;updateSteps(1);q('#hc292Provider').innerHTML='';
 const retry=q('#hc309TrySearch');retry.hidden=true;
 if(!directoryReady)return;
 if(!f.elements.date.validity.valid){
   q('#hc292Directory').replaceChildren();
   q('#hc292Status').textContent='Elegí una fecha de hoy en adelante.';
   return;
 }""")
replace("p.modes[mode]?.enabled&&p.modes[mode].weekly.days[day]?.active", "p.modes?.[mode]?.enabled&&p.modes[mode].weekly?.days?.[day]?.active&&p.modes[mode].rates?.length")
replace("q('#hc292Status').textContent=found.some(p=>p?.failed)?'No se pudo comprobar toda la disponibilidad. Volvé a intentar.':'Profesionales con horarios disponibles para el día elegido.';",
        """const incomplete=found.some(item=>item?.failed);
 retry.hidden=!incomplete;
 q('#hc292Status').textContent=incomplete?'No se pudo consultar toda la disponibilidad.':providers.length===1?'1 profesional disponible':providers.length?providers.length+' profesionales disponibles':'';""")
replace("||'<p>No hay horarios disponibles para esa modalidad y día. Probá otra fecha.</p>';\n updateSteps",
        "||(!incomplete?'<p class=\"hc309Empty\">No hay horarios publicados para esa fecha. Podés cambiar el día o ampliar el filtro de especialidad.</p>':'');\n updateSteps")
start = page.index(" f.elements.role.onchange=()=>{specialties();render();};")
end = page.index("\n async function detail(",start)
replace(page[start:end], """ const choiceButtons=[...root.querySelectorAll('[data-care-mode]')];
 const locationBar=root.querySelector('.hc299LocateBar'),locationStatus=q('#hc299LocationStatus');
 const retry=q('#hc309TrySearch');
 function selectMode(){
   choiceButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.careMode===f.elements.mode.value)));
   locationBar.hidden=f.elements.mode.value!=='office';
 }
 choiceButtons.forEach(button=>button.onclick=()=>{
   if(f.elements.mode.value===button.dataset.careMode)return;
   f.elements.mode.value=button.dataset.careMode;
   selectMode();render();
 });
 selectMode();
 f.onsubmit=event=>{event.preventDefault();render();};
 f.elements.role.onchange=()=>{specialties();render();};
 for(const name of ['specialty','date'])f.elements[name].onchange=render;
 f.elements.mode.onchange=()=>{selectMode();render();};
 q('#hc292InstitutionSearch').onclick=()=>window.hc292InstitutionBooking?.();
 q('#hc299Locate').onclick=e=>run(e.currentTarget,async()=>{
   locationStatus.textContent='Buscando ubicación…';
   const location=await window.HC299Geo.locate();
   if(!f.isConnected)return;
   patientPosition=location;
   locationStatus.textContent='Consultorios ordenados por cercanía.';
   q('#hc299ClearLocation').hidden=false;
   if(f.elements.mode.value==='office')render();
 },locationStatus);
 q('#hc299ClearLocation').onclick=()=>{
   patientPosition=null;locationStatus.textContent='Ubicación quitada de esta búsqueda.';
   q('#hc299ClearLocation').hidden=true;render();
 };
 async function loadDirectory(){
   retry.hidden=true;q('#hc292Status').textContent='Cargando agendas…';
   try{
     directory=await api('directory');
     if(seq!==searchSerial||!f.isConnected)return;
     directoryReady=true;specialties();await render();
   }catch(e){
     if(seq!==searchSerial||!f.isConnected)return;
     q('#hc292Status').textContent='No se pudieron cargar las agendas. '+e.message;
     retry.hidden=false;
   }
 }
 retry.onclick=()=>directoryReady?render():loadDirectory();
 specialties();await loadDirectory();""")
replace("box.scrollIntoView({block:'start',behavior:'smooth'});let selected=null,revision=p.revision,slotSerial=0,requestId=crypto.randomUUID();",
        """box.classList.add('hc309SelectedProfile');
 box.querySelector('h2').tabIndex=-1;box.querySelector('h2').focus();
 box.scrollIntoView({block:'start'});let selected=null,revision=p.revision,slotSerial=0,requestId=crypto.randomUUID(),reserving=false;""")
replace("const can=()=>reserve.disabled=!selected", "const can=()=>reserve.disabled=reserving||!selected")
start = page.index(" plan.onchange=load;")
end = page.index(";if(!trial&&(!directory.paymentsReady", start)
old = page[start:end]
new = old.replace("reserve.onclick=()=>run(reserve,async()=>{", """reserve.onclick=async()=>{
   if(reserving||reserve.disabled)return;
   reserving=true;const accept=q('#hc292Accept');
   plan.disabled=accept.disabled=true;
   try{await run(reserve,async()=>{""")
new += """;}
   finally{reserving=false;plan.disabled=accept.disabled=false;if(plan.isConnected)can();}
 }"""
replace(old,new)

replace("selected=j.slots[Number(b.dataset.teleSlot)];status.dataset.location", """const slot=j.slots[Number(b.dataset.teleSlot)];
 if(selected?.start!==slot.start){requestId=crypto.randomUUID();q('#hc292Accept').checked=false;}
 selected=slot;status.dataset.location""")
replace("plan.disabled=accept.disabled=true;", """plan.disabled=accept.disabled=true;
   const slots=[...box.querySelectorAll('[data-tele-slot]:enabled')];slots.forEach(slot=>slot.disabled=true);""")
replace("plan.disabled=accept.disabled=false;if(plan.isConnected)can();", "plan.disabled=accept.disabled=false;slots.forEach(slot=>slot.disabled=false);if(plan.isConnected)can();")
replace("window.hc289Toast('Reserva confirmada. Podés verla en Mis turnos.');", """window.hc289Toast(j.visit.status==='awaiting_payment'?'Reserva pendiente de pago. Podés verla en Mis turnos.':'Reserva confirmada. Podés verla en Mis turnos.');""")
replace("E(n.payload.visitId)", "E(n.payload?.visitId||'')")
# Agenda: show the invalid field, even when its day or group is collapsed.
replace("if(!f.checkValidity())throw Error('Revisá especialidad, matrícula, importes y CBU/CVU.');",
        "if(!window.HC309.agendaValid(f,mode))return;")
replace('name="display_name" maxlength="200"', 'name="display_name" required maxlength="200"')
replace("add(d);$('[data-active]',d).checked=true;", "const count=$('[data-windows]',d).children.length;add(d);if($('[data-windows]',d).children.length>count){$('[data-active]',d).checked=true;$('[data-windows]',d).lastElementChild.querySelector('[data-start]').focus();}")
replace("profile=r.profile;editing(false);saveStatus.textContent=", "profile=r.profile;editing(false);status.textContent='Agenda guardada';saveStatus.textContent=")
replace("const status=q('[data-status]',el);if(status?.textContent.startsWith('Agenda guardada.'))", "window.HC309.bindAgenda(f);const status=q('[data-status]',el);if(status?.textContent.startsWith('Agenda guardada.'))")

replace('se gestiona desde Mis ámbitos.', 'se abre desde Cuenta → Cambiar lugar de atención.')
replace('>Estado / cancelar / finalizar</button>', '>Gestionar consulta</button>')
# An older save must not acknowledge a newer draft typed while it was in flight.
replace("const result=await api('saveClinicalRecord',{visitId:id,revision,record:Object.fromEntries(new FormData(f))});revision=result.note.revision;f.dataset.clinicalDirty='0';clinicalDrafts.delete(key);status.textContent='Evolución guardada en el servidor · revisión '+revision;",
        """const record=Object.fromEntries(new FormData(f));
 const result=await api('saveClinicalRecord',{visitId:id,revision,record});
 revision=result.note.revision;
 if(JSON.stringify(clinicalDrafts.get(key)||record)!==JSON.stringify(record)){
   status.textContent='Guardado. Tenés cambios posteriores pendientes.';
   return;
 }
 f.dataset.clinicalDirty='0';clinicalDrafts.delete(key);
 status.textContent='Evolución guardada en el servidor · revisión '+revision;""")
replace("await window.hc297MountClinical($('[data-notes]',main),id);await window.hc292Documents($('[data-documents]',main),id,j);}catch(e){main.innerHTML='<p>'+E(e.message)+'</p>';}",
        """const notes=$('[data-notes]',main),docs=$('[data-documents]',main);
 await Promise.all([
   window.hc297MountClinical(notes,id),
   window.hc292Documents(docs,id,j).catch(error=>{docs.textContent='Documentos: '+error.message;})
 ]);
 }catch(e){if(sequence===openSequence&&root.isConnected)main.innerHTML='<p role="status">'+E(e.message)+'</p>';}""")

css = (root/'ui/v309.css').read_text()
js = (root/'ui/v309.js').read_text()
end = page.rindex('</body>')
page = page[:end] + '<style id="hc-v309-styles">\n'+css+'</style>\n<script id="hc-v309-ui">\n'+js+'</script>\n'+page[end:]
for filename in ('index.html','Hospitalito_v309.html'):
    (root/filename).write_text(page)
