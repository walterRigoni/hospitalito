"""Build the standalone application from the published v307 and its UI corrections."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / "Hospitalito_v307.html").read_text()


def replace(old, new):
    global page
    if page.count(old) != 1:
        raise ValueError("Expected one release anchor: " + old[:85])
    page = page.replace(old, new, 1)


replace('<title>Hospitalito v307', '<title>Hospitalito v308')
replace('const CURRENT_VERSION = 307;', 'const CURRENT_VERSION = 308;')
replace('window.HC_DEMO_VERSION="v307";document.title="Hospitalito · Historia Clínica Digital · v307";',
        'window.HC_DEMO_VERSION="v308";document.title="Hospitalito · Historia Clínica Digital · v308";')
replace('<small class="hc305Version">v307</small>', '<small class="hc305Version">v308</small>')
replace('Historia Clínica <span id="hc307Version">v307</span>',
        '<span id="hc308BrandName">Historia Clínica</span> <span id="hc307Version">v308</span>')
replace("const title=$('.topbar>div:first-child>div[style*=\"font-weight\"]');if(title&&s.programName)",
        "const title=$('#hc308BrandName');if(title&&s.programName)")
replace('<label>Usuario</label>\n        <input id="loginUser"', '<label for="loginUser">Usuario o correo</label>\n        <input id="loginUser"')
replace('<label>Contraseña</label>\n        <input id="loginPass"', '<label for="loginPass">Contraseña</label>\n        <input id="loginPass"')
replace('<h3 style="margin:6px 0 10px;">Ingreso</h3>', '<h3 style="margin:6px 0 16px;">Ingresar a Hospitalito</h3>')
start = page.index('    <div class="muted"', page.index('id="loginMessageBox"'))
end = page.index('</div>', start) + len('</div>')
replace(page[start:end], '<details class="hc308AdminHelp"><summary>Acceso de administración local</summary><p>El administrador institucional puede vincular este equipo desde la cuenta de administración local.</p></details>')
replace("host.appendChild(b);}\n const account=q('#btnAccount')", "q('#btnLogin').parentElement.after(b);}\n const account=q('#btnAccount')")
replace("b.textContent='Registrarse';b.style", "b.textContent='Crear cuenta de paciente';b.style")
replace("+'<span class=\"hc289Sr\">'+esc(label)", "+'<span class=\"hc308ActionLabel\">'+esc(label)")
replace("edit.textContent='✎';edit.title=", "edit.textContent='Acciones';edit.title=")
replace("exit.textContent='↩';exit.title=", "exit.textContent='Salir';exit.title=")

# Organize existing actions only after the original permissions filter.
replace(" button.setAttribute('aria-controls',menu.id);", """
 const menuGroups = [
   ['Atención', ['private-workspaces', 'shift', 'institution-tele', 'outpatient', 'chat']],
   ['Mi cuenta', ['account', 'notifications', 'security', 'settings']],
   ['Institución', ['members', 'institutions', 'license']]
 ];
 const actions = new Map([...menu.querySelectorAll('button')].map(item => [item.dataset.hc289Menu, item]));
 for (const [label, keys] of menuGroups) {
   const items = keys.map(key => actions.get(key)).filter(Boolean);
   if (!items.length) continue;
   const group = document.createElement('div');
   group.className = 'hc308MenuGroup';
   group.setAttribute('role', 'group');
   group.setAttribute('aria-label', label);
   const heading = document.createElement('h3');
   heading.textContent = label;
   group.append(heading, ...items);
   menu.append(group);
 }
 if (actions.has('logout')) menu.append(actions.get('logout'));
 menu.dataset.grouped = 'true';
 button.setAttribute('aria-controls',menu.id);""")

# Both modes already live inside a single editor. Keep the actual inputs, listeners
# and edit identity while switching, including dynamically generated ventilator fields.
start = page.index('  // eventos: modo plantilla/libre')
end = page.index('  // ARM dinámico', start)
replace(page[start:end], """  function showEvoMode(free) {
    wrap.querySelector('#evoLibreWrap').style.display = free ? '' : 'none';
    wrap.querySelector('#evoPlantillaWrap').style.display = free ? 'none' : '';
    for (const [id, active] of [['#btnEvoModeLibre', free], ['#btnEvoModePlantilla', !free]]) {
      const button = wrap.querySelector(id);
      button.classList.toggle('primary', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
  showEvoMode(isLibre);
  wrap.querySelector('#btnEvoModePlantilla').onclick = () => showEvoMode(false);
  wrap.querySelector('#btnEvoModeLibre').onclick = () => showEvoMode(true);

""")
start = page.index(" for(const id of ['btnEvoModePlantilla','btnEvoModeLibre']")
end = page.index(' return value;', start)
replace(page[start:end], '')
replace("evoRenderEditor(rec||{kind:d.mode,data:{}});evoSetState(evoUIState);",
        "evoRenderEditor(rec||{kind:d.mode,data:{}});q(d.mode==='libre'?'#btnEvoModeLibre':'#btnEvoModePlantilla')?.click();evoSetState(evoUIState);")
start = page.index("function applyDraft(d,root)")
end = page.index('async function readDraft', start)
replace(page[start:end], """function applyDraft(d,root){
 if (!root || !d || d.institutionId!==scope() || d.username!==actor() || d.pid!==String(selectedPatientId)) return false;
 function restoreFields() {
   root.querySelectorAll('input,textarea,select').forEach((field,index)=>{
     const saved = d.controls[field.id || 'control:'+index];
     if (!saved || field.type==='file') return;
     field.value = saved.value;
     if (saved.type==='checkbox' || saved.type==='radio') field.checked = !!saved.checked;
   });
 }
 restoreFields();
 root.querySelectorAll('select,input[type=checkbox]').forEach(field=>field.dispatchEvent(new Event('change',{bubbles:true})));
 restoreFields();
 if(d.attachments){ window.__evoAttach={...d.attachments}; updateAttachButtons(); }
 notifyDraft(root);
 return true;
}
""")
# Never replace a draft with a different patient's form while a screen refresh is pending.
replace("if(!visible(root))return null;const controls={};", "if(!visible(root)||(module==='evolucion'&&root.dataset.hc280Patient!==String(selectedPatientId)))return null;const controls={};")

replace("if(box.innerHTML!==html)box.innerHTML=html;", "if(box.hcHistoryContent!==html){box.innerHTML=html;box.hcHistoryContent=html;}")
replace('touch-action:pan-y pinch-zoom !important;\n}', 'touch-action:pan-x pan-y pinch-zoom !important;\n}')
replace("q('#hc289DetailClose').onclick=()=>root.innerHTML=''", "q('#hc289DetailClose').onclick=()=>{resetProvider();renderLists();}")
replace("let calendarSerial=0;", """let calendarSerial=0;
function clearBookingSlot(){
 if(bookingUI)bookingUI.slot=null;
 const button=q('#hc289Book'),slots=q('#hc289Slots');
 if(button)button.disabled=true;
 if(slots)slots.replaceChildren();
}""")
replace("const seq=++calendarSerial;try{const c=await api('calendar',{providerId:s.providerId,month:s.month});if(seq!==calendarSerial||!bookingUI)return;const root=q('#hc289Availability');",
        """const seq=++calendarSerial,root=q('#hc289Availability');
 clearBookingSlot();
 if(!root)return;
 root.textContent='Cargando horarios…';
 try{const c=await api('calendar',{providerId:s.providerId,month:s.month});
 if(seq!==calendarSerial||bookingUI!==s||!root.isConnected)return;""")
replace("b.onclick=()=>{selectedDay=b.dataset['289Day'];root.querySelectorAll", "b.onclick=()=>{clearBookingSlot();selectedDay=b.dataset['289Day'];root.querySelectorAll")
replace("}catch(e){if(q('#hc289Availability'))q('#hc289Availability').textContent=e.message;}", "}catch(e){if(seq===calendarSerial&&root.isConnected)root.textContent=e.message;}")
replace("try{directory=await api('directory');q('#hc289Specialty')", "const form=bookingUI;try{const next=await api('directory');if(bookingUI!==form||!q('#hc289Specialty'))return;directory=next;q('#hc289Specialty')")
replace("renderLists();}catch(e){q('#hc289ProviderList').textContent=e.message;}", "renderLists();}catch(e){if(bookingUI===form&&q('#hc289ProviderList'))q('#hc289ProviderList').textContent=e.message;}")
replace("window.hc289EnterClient=async function(a){appointmentSync=", "window.hc289EnterClient=async function(a){me=null;position=null;bookingUI=null;selectedDay='';month=new Date(new Date().getFullYear(),new Date().getMonth(),1);directory={institutions:[],providers:[]};appointmentSync=")
replace("api('directory').then(d=>{directory=d;if(main()?.dataset.view==='appointments')", "api('directory').then(d=>{if(window.hc289ClientSession?.token!==a.token)return;directory=d;if(main()?.dataset.view==='appointments')")
replace("if(render&&!bookingUI)calendarView();", "if(render&&!bookingUI&&(!main()?.dataset.view||main().dataset.view==='calendar'))calendarView(selectedDay);")
replace("if(!bookingUI?.slot)throw Error", "if(!bookingUI?.slot||!bookingUI.providerId)throw Error")

# The stray character before a style element also made the browser close <head> early.
replace('+<style id="hcV258HemotherapyStyles">', '<style id="hcV258HemotherapyStyles">')
replace("q('img.hc296Portrait',body)?.remove();", "const photo=q('img.hc296Portrait',body);if(photo)summary.prepend(photo);")
replace('>Mis ámbitos</button><button type="button" data-exit', '>Cambiar lugar de atención</button><button type="button" data-exit')
replace("const attempt=++slotSerial;selected=null;can();requestId=", """const attempt=++slotSerial;selected=null;
 q('#hc292Accept').checked=false;const route=q('#hc299Route');route.hidden=true;route.removeAttribute('href');
 if(status.dataset.location){status.textContent='';delete status.dataset.location;}
 can();requestId=""")
replace("status.textContent=selected.address?'Ubicación elegida: '+selected.address:'';", "status.dataset.location='true';status.textContent=selected.address?'Ubicación elegida: '+selected.address:'';")
replace("}catch(e){if(plan.isConnected)q('#hc292Slots').textContent=e.message;}", "}catch(e){if(attempt===slotSerial&&plan.isConnected)q('#hc292Slots').textContent=e.message;}")
replace("if(render&&!bookingUI&&(!main()?.dataset.view||main().dataset.view==='calendar'))calendarView(selectedDay);",
        "if(render&&!bookingUI&&!main()?.dataset.view)appointmentsView();else if(render&&!bookingUI&&main()?.dataset.view==='calendar')calendarView(selectedDay);")
# Resolve form fields while they are still inside the form.
replace("const profileGrid=document.createElement('div');profileGrid.className='hc298ProfileGrid';",
        "profile.open=!f.elements.credential.value||!f.elements.specialty.value;const profileGrid=document.createElement('div');profileGrid.className='hc298ProfileGrid';")
replace("profile.append(profileGrid);profile.open=!f.elements.credential.value||!f.elements.specialty.value;", "profile.append(profileGrid);")
# A visible editor protects unsaved work during background refresh. Close it after
# a successful save so the viewer opens and another tap cannot duplicate the note.
save_end = 'toast("Evolución guardada");\n    evoUIState = "view";'
if page.count(save_end) != 2:
    raise ValueError("Expected both evolution save handlers")
page = page.replace(save_end, 'toast("Evolución guardada");\n    evoSetState("view");\n    window.hc280CompleteDraft?.("evolucion");')
replace("const editorBase=evoRenderEditor;", "window.hc280CompleteDraft=clearDraft;\nconst editorBase=evoRenderEditor;")
replace("if(b.matches('#btnSaveEvo,#btnSaveEvoFree')){persistDrafts();setTimeout(()=>{if(evoUIState==='view'&&!visible(q('#evoEditorWrap')))clearDraft('evolucion');},0);}",
        "if(b.matches('#btnSaveEvo,#btnSaveEvoFree'))persistDrafts();")
replace("if(!d)return false;if(module==='evolucion'){const arr=evoGetList", "if(!d||d.pid!==String(selectedPatientId)||d.username!==actor()||d.institutionId!==scope())return false;if(module==='evolucion'){const arr=evoGetList")
replace("if(who.parentElement!==account.parentElement)account.before(who);", "")
replace('if(left) left.appendChild(btn);', 'const account=document.getElementById("btnAccount");if(account)account.before(btn);else if(left)left.appendChild(btn);')
replace("['Mis ámbitos','private-workspaces']", "['Cambiar lugar de atención','private-workspaces']")
replace('Evolución • Doble click en una fila para abrir', 'Evolución del paciente')
start=page.index('function evoRenderList(pid)')
end=page.index('function evoBuildPrintDoc()',start)
old=page[start:end]
new=old.replace('const row = document.createElement("div");', 'const row = document.createElement("button");\n    row.type="button";row.className="hc308EvolutionRow";row.setAttribute("aria-pressed",String(isOpen));')
new=new.replace('<div style=', '<span style=').replace('<div class=', '<span class=').replace('</div>', '</span>')
new=new.replace('${isOpen ? "abierta" : "doble click"}', '${isOpen ? "Abierta" : "Abrir"}')
new=new.replace('row.ondblclick = ()=>{', 'row.onclick = ()=>{\n      window.hc280PersistDrafts?.();')
new=new.replace('      evoRenderList(pid);', '''      evoRender();
      document.querySelector('#evoList button[aria-pressed="true"]')?.focus({preventScroll:true});''')
replace(old,new)
replace("const options=window.hc292SpecialtyOptions(j.role,[p.specialty]);", """const options='<option value="">Elegí tu especialidad</option>'+window.hc292SpecialtyOptions(j.role,[p.specialty]);""")
replace('data-hc305-nav="new">＋ Nuevo turno</button></nav>', 'data-hc305-nav="new">Nuevo turno</button><button type="button" id="hc308RegistryToggle" aria-controls="hc289Registry">Mi registro</button></nav>')
start=page.index('function setupSidebar()')
end=page.index('\n',start)
replace(page[start:end], """function setupSidebar(){
 const sidebar=q('#hc289Registry'),grip=q('.hc289Resize'),toggle=q('#hc308RegistryToggle');
 let down=0,start=0,moved=false;
 function sync(){const open=!sidebar.classList.contains('collapsed');toggle.setAttribute('aria-expanded',String(open));grip.textContent=open?'‹':'›';}
 function flip(){sidebar.classList.toggle('collapsed');sync();}
 toggle.onclick=flip;
 grip.setAttribute('aria-controls',sidebar.id);
 grip.onpointerdown=e=>{down=e.clientX;start=sidebar.classList.contains('collapsed')?0:sidebar.offsetWidth;moved=false;grip.setPointerCapture(e.pointerId);};
 grip.onpointermove=e=>{if(!grip.hasPointerCapture(e.pointerId)||Math.abs(e.clientX-down)<=5&&!moved)return;moved=true;const width=Math.min(500,Math.max(0,start+e.clientX-down));sidebar.classList.toggle('collapsed',width<65);sidebar.style.width=Math.max(150,width)+'px';};
 grip.onpointerup=e=>grip.releasePointerCapture(e.pointerId);
 grip.onclick=e=>{if(!moved||e.detail===0)flip();moved=false;};
 sidebar.addEventListener('click',e=>{if(innerWidth<=760&&e.target.closest('#hc289RegistryContent button')){sidebar.classList.add('collapsed');sync();}});
 const portal=q('#hc289Portal');portal.addEventListener('keydown',e=>{if(e.key==='Escape'&&innerWidth<=760&&!sidebar.classList.contains('collapsed')){sidebar.classList.add('collapsed');sync();toggle.focus();}});
 portal.querySelector('.hc305PortalNav').addEventListener('click',e=>{if(innerWidth<=760&&e.target.closest('[data-hc305-nav]'))sidebar.classList.add('collapsed');});
 new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});sync();
}""")
# Keep the exit action legible at the reserved top-right position.
css = (root/'ui/v308.css').read_text()
script = (root/'ui/v308.js').read_text()
end = page.rindex('</body>')
page = page[:end] + '<style id="hc-v308-styles">\n' + css + '</style>\n<script id="hc-v308-ui">\n' + script + '</script>\n' + page[end:]
for filename in ['index.html','Hospitalito_v308.html']:
    (root / filename).write_text(page)
