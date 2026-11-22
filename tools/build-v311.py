"""Build the v311 entry points from the standalone v310 release."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
page = (ROOT / "Hospitalito_v310.html").read_text(encoding="utf-8")


def change(old, new):
    global page
    if page.count(old) != 1:
        raise ValueError(f"Expected one v310 anchor, found {page.count(old)}: {old[:125]}")
    page = page.replace(old, new)


def region(start, end, new):
    begin = page.index(start)
    finish = page.index(end, begin)
    change(page[begin:finish], new)


for old, new in [
    ("CURRENT_VERSION = 310;", "CURRENT_VERSION = 311;"),
    ("<title>Hospitalito v310", "<title>Hospitalito v311"),
    ('window.HC_DEMO_VERSION="v310";document.title="Hospitalito · Historia Clínica Digital · v310";',
     'window.HC_DEMO_VERSION="v311";document.title="Hospitalito · Historia Clínica Digital · v311";'),
    ('<span id="hc307Version">v310</span>', '<span id="hc307Version">v311</span>'),
    ('>Hospitalito <small>v310</small>', '>Hospitalito <small>v311</small>'),
]:
    change(old, new)

# Sign-in and password confirmation share the same response validation and retry policy.
region("  async function quickLogin(username,password){", "  async function enterFast(",
       """  async function quickLogin(username,password){
    return window.HC311.signIn(LOGIN_URL,LOGIN_URL.replace('hospitalito-login','hospitalito-auth'),
      PUB,{username,password},()=>hcLoginMessage?.('Estamos restableciendo la conexión…','info'));
  }
""")
change('  async function authRequest(action,payload={}){\n    let last=null;',
       '''  async function authRequest(action,payload={}){
    if(action==="authenticateUser")return window.HC311.signIn(LOGIN_URL,AUTH_URL,PUB_KEY,payload);
    let last=null;''')
region("    const isLogin=action===\"authenticateUser\";", "    throw last||new Error(",
       """    for(let attempt=0;attempt<2;attempt++){
      try{return await hc235AuthFetch(AUTH_URL,action,payload,30000);}
      catch(e){
        last=e;
        if(e?.noRetry)throw e;
        if(!attempt)await new Promise(resolve=>setTimeout(resolve,350));
      }
    }
""")
change("const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'No se pudo verificar tu acceso.');return j;",
       "return await window.HC311.accessResponse(r,action);")
change("async function passwordAuth(username,password){return request('hospitalito-login','authenticateUser',{username,password});}",
       "async function passwordAuth(username,password){return window.hc230AuthRequest('authenticateUser',{username,password});}")
change("hcLoginMessage?.(String(e?.message||e)||'No se pudo iniciar sesión.');",
       "hcLoginMessage?.(e instanceof Error?e.message:'No se pudo iniciar sesión.');")

# Keep the non-visual logout hook used by legacy handlers and remove visible header exits.
change('<button class="btn small" id="btnLogout" type="button" style="display:none;">Salir</button>',
       '<span id="btnLogout" hidden></span>')
change('<button type="button" data-exit>Salir de mi cuenta</button>', '')
change("if(section==='logout')return $('[data-exit]',root).click();",
       "if(section==='logout'){clinicalDrafts.clear();return window.hc300ReturnLogin();}")
region(" $('[data-exit]',root).onclick=", " const list=$('[data-visits]',root)",
       "")
region("function addPanelExit(root){", " const chooser=q('#btnCloseInstitutionChooser');",
       "function decorate(){\n")
region(" for(const el of document.querySelectorAll('.hc289Dialog')){const close=", "\n}\ndocument.addEventListener('click',e=>{",
       """ for(const button of document.querySelectorAll(
   '.hc289Close:not(.hc311Close),#btnCloseInstitutionChooser:not(.hc311Close),#hcSettingsCloseBtn:not(.hc311Close),[data-settings-close]:not(.hc311Close)'
 )){
   button.classList.add('hc311Close');button.innerHTML=window.hc289Icon('close');
   button.title='Cerrar';button.setAttribute('aria-label','Cerrar');
 }""")
change(" const privateExit=e.target.closest?.('#hc297Workspace [data-exit]');if(privateExit){e.preventDefault();e.stopImmediatePropagation();returnLogin();}\n", "")
change('class="hcSettingsBtn" id="hcSettingsCloseBtn" type="button">Cerrar</button>',
       'class="hcSettingsBtn" id="hcSettingsCloseBtn" type="button" aria-label="Cerrar" title="Cerrar">×</button>')
change('type="button" data-close-detail>Cerrar ficha</button>',
       'type="button" class="hc311Close" data-close-detail aria-label="Cerrar ficha" title="Cerrar ficha">'+ "'+window.hc289Icon('close')+'"+'</button>')
# The profile's security and passkey controls stay inside the shared settings stage.
change("const base=window.hc289ClientAccount;window.hc289ClientAccount=async function(section){await base(section);",
       "const base=window.hc289ClientAccount;window.hc289ClientAccount=async function(section,inSettings){await base(section,inSettings);")
change("el.append(box);box.querySelector('[data-enroll]').onclick=enroll;",
       "(el.querySelector('.hcSettingsStage')||el).append(box);box.querySelector('[data-enroll]').onclick=enroll;")
change("function dialog(title,html){q('#hc289Dialog')?.remove();",
       "function dialog(title,html,{fullscreen=false}={}){const previous=q('#hc289Dialog');if(previous?.hc311Dismiss)previous.hc311Dismiss();else previous?.remove();")
change("if(window.hc289ClientSession&&portal&&title!=='Sesión bloqueada'){",
       """if(fullscreen&&window.hc289ClientSession&&portal){
   window.HC311.openAccountPanel(portal.closest('#hc289Portal'),el);
 }else if(window.hc289ClientSession&&portal&&title!=='Sesión bloqueada'){""")
change("()=>el.classList.contains('hc310Inline')?calendarView():el.remove();el.querySelector",
       "()=>el.hc311Dismiss?el.hc311Dismiss():el.classList.contains('hc310Inline')?calendarView():el.remove();el.querySelector")
change("if(el.classList.contains('hc310Inline'))portalActions?.home();",
       "if(el.hc311Dismiss)el.hc311Dismiss();\n    else if(el.classList.contains('hc310Inline'))portalActions?.home();")
change("async function clientAccount(section,inSettings=false){",
       "let accountRequest=0;\nasync function clientAccount(section,inSettings=false){\n const opening=++accountRequest,owner=window.hc289ClientSession?.token;")
change("if(!inSettings&&section!=='settings')return dialog(title,content);",
       "if(!inSettings&&section!=='settings')return dialog(title,content,{fullscreen:true});")
change("dialog(title,window.HC310.settingsMarkup(content,section));",
       "dialog(title,window.HC310.settingsMarkup(content,section),{fullscreen:true});")
change("window.HC310.bindSettings(el,key=>clientAccount(key,true));",
       "window.HC310.bindSettings(el,key=>window.hc289ClientAccount(key,true));")
change("if(section==='notifications'){return window.hc296Notifications();}\n if(!me)await refresh();",
       """if(section==='notifications'){return window.hc296Notifications({fullscreen:true});}
 if(section==='reminders'){
   const el=panel('Avisos de turnos','<h3>Recordatorios de mis turnos</h3><label class="hc289Check"><input type="checkbox"> Mostrar avisos emergentes en este dispositivo</label><p role="status"></p>');
   window.HC311.editPatientReminders(el);return;
 }
 if(!me)await refresh();
 if(opening!==accountRequest||owner!==window.hc289ClientSession?.token)return;""")
change("sections = {account:'Perfil',settings:'Apariencia',privacy:'Seguridad'}",
       "sections = {account:'Perfil',settings:'Apariencia',privacy:'Seguridad',reminders:'Avisos de turnos'}")
change("(key===selected?' class=\"active\" aria-current=\"page\"':'')+",
       """' class="hcSettingsNavBtn'+(key===selected?' active':'')+'"'+(key===selected?' aria-current="page"':'')+""")
change("window.hc296Notifications=async function(){",
       "window.hc296Notifications=async function({fullscreen=false}={}){")
change('<div data-reminders role="status">Cargando…</div>\');', '<div data-reminders role="status">Cargando…</div>\',{fullscreen});')
change("if(id==='booking-alerts'){window.hc296Notifications();return;}",
       "if(id==='booking-alerts'){window.hc296Notifications({fullscreen:!!window.hc289ClientSession});return;}")
change("if(b.dataset.institutionVisit)return window.hc310InstitutionVisit(b.dataset.institutionVisit);",
       "if(b.dataset.institutionVisit){el.hc311Dismiss?.();return window.hc310InstitutionVisit(b.dataset.institutionVisit);}")

# Typography previews render as a keyboard-operable disclosure with native radio options.
old_start = "+'</div><p><label>Fuente tipográfica <select data-vfont>'"
start = page.index(old_start)
end = page.index("<p>Vista previa:", start)
change(page[start:end], "+'</div>'+window.HC311.fontPicker(fonts,v.font)+'")
change("if(e.target.matches('[data-vfont]'))saveVisual({font:e.target.value});",
       """if(e.target.matches('[data-vfont]')){
 const wrapper=e.target.closest('.hc311Font').parentElement.parentElement;
 saveVisual({font:e.target.value});wrapper?.querySelector('.hc311Font summary')?.focus();
}""")

change("window.hc289PersonalizeRefresh=()=>{if(q('#hcSettingsNav [data-hcs-section=personalization].active'))q('#hcSettingsContent').innerHTML=personalization();};",
       """window.hc289PersonalizeRefresh=()=>{
 const panel=q('#hc289Dialog .hc311Font')?.closest('.hcSettingsPage');
 if(panel)panel.outerHTML=personalization();
 else if(q('#hcSettingsNav [data-hcs-section=personalization].active'))q('#hcSettingsContent').innerHTML=personalization();
};""")
region("if(section==='settings'){const el=panel('Configuración',window.hc289Personalization());",
       "if(section==='privacy')",
       "if(section==='settings'){panel('Configuración',window.hc289Personalization());return;}")
region("    if(section==='settings'){\n      const previous=window.hc289PersonalizeRefresh;",
       "    const box=$('.hc310Profile',el);", "    if(section==='settings')return;\n")

# The sidebar has four equivalent sections. Calendar and appointment detail remain related.
change('<h2>Mis Turnos</h2><nav class="hc310SideNav" aria-label="Portal del paciente">',
       '<nav class="hc310SideNav" aria-label="Portal del paciente">')
change('<button type="button" data-hc310-studies>Mis Estudios</button><button type="button" data-hc310-reminders>Avisos</button></nav>',
       '<button type="button" data-portal-section="turns">Mis Turnos</button><button type="button" data-hc310-studies data-portal-section="studies">Mis Estudios</button><button type="button" data-hc310-reminders data-portal-section="alerts">Avisos</button><button type="button" data-portal-section="prescriptions">Mis Recetas</button></nav>')
change("    $('[data-hc310-studies]',portal).onclick = () => choose(actions.studies);\n    $('[data-hc310-reminders]',portal).onclick = () => choose(actions.reminders);",
       """    const sections={turns:actions.turns,studies:actions.studies,alerts:actions.reminders,prescriptions:actions.prescriptions};
    portal.querySelectorAll('[data-portal-section]').forEach(button=>button.onclick=()=>choose(()=>{
      window.HC311.markPortal(button.dataset.portalSection);
      sections[button.dataset.portalSection]();
    }));""")
change("home:()=>calendarView(), book:()=>newBooking(), studies:()=>resultsView(),",
       """home:()=>calendarView(), book:()=>newBooking(), turns:()=>openMyAppointments(), studies:()=>resultsView(),
  prescriptions:()=>{
    const root=main();root.dataset.view='prescriptions';bookingUI=null;
    return window.HC311.prescriptions(root);
  },""")
change("const sidebar=q('#hc289Registry');if(innerWidth<=760)sidebar?.classList.add('collapsed');\n appointmentsView(true);",
       "appointmentsView(true);")
change("root.dataset.view='calendar';bookingUI=null;", "root.dataset.view='calendar';window.HC311.markPortal('turns');bookingUI=null;")
change("main().dataset.view='results';bookingUI=null;", "main().dataset.view='results';window.HC311.markPortal('studies');bookingUI=null;")
change("main.dataset.view='tele-search';window.hc310ReleaseBooking();", "main.dataset.view='tele-search';window.HC311.markPortal('');window.hc310ReleaseBooking();")
change("if(previous&&unread.some(n=>!previous.has(n.id)))", "if(previous&&window.HC311.patientReminderPopups()&&unread.some(n=>!previous.has(n.id)))")
region("const target=q('#hc289RegistryContent');if(target&&!target.querySelector('[data-292-visits]')){",
       "if(session?.role==='superadmin'&&!q('#hc292AdminTop'))", "")
change('<option value="prescription">Receta médica</option>', '<option value="prescription">Receta médica de plataforma externa</option>')
change('<label>PDF firmado (hasta 5 MB)<input name="file"', '<p class="hc289Full hc310Muted">Para una receta, adjuntá el PDF firmado que emitiste en el recetario que uses. Se publicará en Mis Recetas de este paciente.</p><label>PDF firmado (hasta 5 MB)<input name="file"')

# The checkbox stays in place while the booking controls switch to the phone link.
change("""    main.innerHTML='<div class="hc310Booking"><button""",
       """    main.innerHTML='<div class="hc310Booking">'+
      '<label class="hc310Urgency"><input type="checkbox" id="hc289Urgent"> URGENCIA</label>'+
      '<div id="hc310UrgentHelp" hidden><a href="tel:107">Llamar al 107</a></div>'+
      '<div data-booking-controls><button""")
change("""      '<label class="hc310Urgency"><input type="checkbox" id="hc289Urgent"> URGENCIA</label>'+
      '<aside id="hc310UrgentHelp" hidden><p>Si necesitás atención inmediata, llamá a emergencias. Los turnos de este portal son programados.</p><a href="tel:107">Llamar al 107</a></aside>'+
""", "")
change('<div id="hc292Provider"></div></div>\';', '<div id="hc292Provider"></div></div></div>\';')
change("$('#hc289Urgent',root).onchange=event=>{$('#hc310UrgentHelp',root).hidden=!event.target.checked;};",
       """$('#hc289Urgent',root).onchange=event=>{
      const checked=event.target.checked;
      $('[data-booking-controls]',root).hidden=checked;
      $('#hc310UrgentHelp',root).hidden=!checked;
    };""")

# Month cards interpolate from their distance to the current track position.
change("    function render(selected = options.selected) {\n      options.selected = selected;\n      $('.hc310MonthHeader h2',host)", """    function paint(position,animate=false) {
      const duration=animate?'160ms ease-out':'0ms';
      track.style.transition='transform '+duration;
      track.style.transform='translateX('+(-(1+position)*100/3)+'%)';
      [...track.children].forEach((card,index)=>{
        const distance=Math.min(1,Math.abs(index-1-position));
        card.style.transition='opacity '+duration+', transform '+duration;
        card.style.transformOrigin=['right center','center','left center'][index];
        card.style.opacity=String(1-.86*distance);
        card.style.transform='scale('+(1-.24*distance)+')';
      });
    }
    function render(selected = options.selected) {
      options.selected = selected;
      $('.hc310MonthHeader h2',host)""")
change("""      track.style.transition='none';track.style.transform='translateX(-33.333333%)';
      track.innerHTML=grid(offset(month,-1),true)+grid(month,false)+grid(offset(month,1),true);""",
       """      track.innerHTML=grid(offset(month,-1),true)+grid(month,false)+grid(offset(month,1),true);
      paint(0);""")
change("""      track.style.transition='transform 160ms ease-out';
      track.style.transform='translateX('+(-100*(1+direction)/3)+'%)';""", "      paint(direction,true);")
change("      track.style.transition='none';track.style.transform='translateX('+((-1+ratio)*100/3)+'%)';",
       "      paint(-ratio);")

for tag, kind, filename in [("style","styles","ui/v311.css"),("script","ui","ui/v311.js")]:
    content = (ROOT / filename).read_text(encoding="utf-8")
    closing = page.rindex("</body>")
    page = page[:closing] + f'<{tag} id="hc-v311-{kind}">\n{content}</{tag}>\n' + page[closing:]

for output in ["index.html", "Hospitalito_v311.html"]:
    (ROOT / output).write_text(page, encoding="utf-8")
