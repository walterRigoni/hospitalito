"""Build the standalone v310 release from the checked-in v309 release."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / "Hospitalito_v309.html").read_text(encoding="utf-8")


def change(old, new):
    global page
    if page.count(old) != 1:
        raise ValueError(f"Expected one v309 anchor, got {page.count(old)}: {old[:120]}")
    page = page.replace(old, new)


def region(start, end, new):
    a = page.index(start)
    b = page.index(end, a)
    change(page[a:b], new)


for old, new in [
    ("<title>Hospitalito v309", "<title>Hospitalito v310"),
    ("const CURRENT_VERSION = 309;", "const CURRENT_VERSION = 310;"),
    ('window.HC_DEMO_VERSION="v309";document.title="Hospitalito · Historia Clínica Digital · v309";',
     'window.HC_DEMO_VERSION="v310";document.title="Hospitalito · Historia Clínica Digital · v310";'),
    ('<small class="hc305Version">v309</small>', '<small class="hc305Version">v310</small>'),
    ('<span id="hc307Version">v309</span>', '<span id="hc307Version">v310</span>')
]:
    change(old, new)

# The portal uses one persistent frame. Account and visit panels use its content area.
region("portal.innerHTML='<header><strong>Portal", ";document.body.append(portal)", "portal.innerHTML=window.HC310.portalMarkup(a.user)")
change("setupSidebar();lastActivity", "setupSidebar();calendarView();lastActivity")
region("function setupSidebar(){", "async function clientAccount", """function setupSidebar(){
 window.HC310.sidebar(q('#hc289Portal'),{
  home:()=>calendarView(), book:()=>newBooking(), studies:()=>resultsView(),
  refresh:()=>refresh(), reminders:()=>window.hc296Notifications()
 });
}
""")
region("function registry(){", "async function refresh(", """function registry(){
 window.HC310.renderSidebar(allBookings(),directory,appointmentSourcesReady(),appointmentWarning(),{
  color:bookingColor, status:statusLabel, format, detail:b=>b.privateVisit?window.hc292Visit(b.id):showInstitutionVisit(b)
 });
}
function showInstitutionVisit(b){
 bookingUI=null;
 const root=main();
 root.dataset.view='appointment';
 root.innerHTML='<button type="button" data-289-back>‹ Calendario</button><h2>Detalle del turno</h2>'+
   bookingRow(b);
}
""")
region("function calendarView(day=", "function changeMonth(", """function calendarView(day=''){
 const root=main();if(!root)return;
 root.dataset.view='calendar';bookingUI=null;selectedDay=typeof day==='string'?day:'';
 const bookings=allBookings();
 window.HC310.calendar(root,{
  month, selected:selectedDay, tall:true,
  getEvents:key=>bookings.filter(b=>localDate(b.starts_at)===key).map(b=>bookingColor(b)),
  onMonth:value=>{month=value;}, onDay:key=>dayView(key),
  warning:appointmentWarning()
 });
}
""")
change("if(render&&!bookingUI&&!main()?.dataset.view)appointmentsView();", "if(render&&!bookingUI&&!main()?.dataset.view)calendarView();")
change("if(main()?.dataset.view==='appointments')appointmentsView();}).catch(()=>{});await refresh(true);", "registry();}).catch(()=>{});await refresh(true);")
change("document.body.append(el);el.querySelector('[data-289-close]').onclick=()=>el.remove();",
       """const portal=q('#hc289PortalMain');
 if(window.hc289ClientSession&&portal&&title!=='Sesión bloqueada'){
   el.classList.add('hc310Inline');el.removeAttribute('aria-modal');
   portal.dataset.view='panel';portal.replaceChildren(el);portal.scrollTop=0;
 }else document.body.append(el);
 el.querySelector('[data-289-close]').onclick=()=>el.classList.contains('hc310Inline')?calendarView():el.remove();""")
change("el.querySelector('[data-292-close]').onclick=()=>{el.remove();refreshPortal();};",
       "el.querySelector('[data-292-close]').onclick=()=>{window.HC310.closePanel(el);refreshPortal();};")
change("const el=dialog('Datos personales',", "const el=dialog('Perfil',")
change("if(section==='settings'){const el=dialog('Configuración',window.hc289Personalization()+'<hr><button id=\"hc289ClientPrivacy\">Seguridad y contraseña</button>');",
       "if(section==='settings'){const el=dialog('Configuración',window.HC310.settingsMarkup(window.hc289Personalization()));")
change("q('#hc289ClientPrivacy').onclick=()=>window.hc289ClientAccount('privacy');return;",
       "window.HC310.bindSettings(el,section=>window.hc289ClientAccount(section));return;")

change("if(!me)await refresh();const p=me?.client||{},profile=p.profile||{},user=window.hc289ClientSession.user;",
       "if(!me)await refresh();const user=window.hc289ClientSession?.user;if(!user)return;const p=me?.client||{},profile=p.profile||{};")
change("'+me.verifications.map(v=>", "'+(me?.verifications||[]).map(v=>")
change("await refresh();el.querySelector('[role=status]').textContent='Perfil guardado.';",
       "window.HC310?.avatar(q('#hc289PortalAccount'),window.hc289ClientSession.user);await refresh();el.querySelector('[role=status]').textContent='Perfil guardado.';")
change("Sólo se muestran informes publicados de tu ficha verificada.</p>':'');}",
       "Los informes aparecen cuando el profesional los publica.</p>':'');window.HC310.privateReports(main());}")
change("window.hc304RefreshPortal=()=>refresh();", """window.hc310InstitutionVisit=id=>{
 const visit=allBookings().find(record=>!record.privateVisit&&String(record.id)===String(id));
 if(visit)showInstitutionVisit(visit);else window.hc289Toast('Este turno no está disponible. Actualizá la lista.');
};
window.hc304RefreshPortal=()=>refresh();""")
change("if(view==='results')resultsView();", "if(view==='results'&&document.activeElement?.closest('#hc289PortalMain')==null)resultsView();")
# Give the profile button the same desktop/touch behavior for each kind of user.
change("(client&&id==='account'?'Datos personales':label)", "label")
change("if(!menu.hidden&&menuTrigger===account)closeMenu();else openMenu(account);",
        """if(!window.HC310.touch(e)||!menu.hidden&&menuTrigger===account){
  closeMenu();if(window.hc289ClientSession)window.hc289ClientAccount('account');
  else window.hcSettingsOpen('account');
 }else openMenu(account);""")
change("let menuTrigger=null;", """let menuTrigger=null,hoverTimer;
document.addEventListener('pointerover',event=>{
 if(event.pointerType!=='mouse')return;
 const button=event.target.closest('#btnAccount,#hc289PortalAccount');
 if(!button&&!menu.contains(event.target))return;
 clearTimeout(hoverTimer);
 if(button&&(menu.hidden||menuTrigger!==button))openMenu(button);
});
document.addEventListener('pointerout',event=>{
 if(event.pointerType==='mouse'&&event.target.closest('#btnAccount,#hc289PortalAccount,#hc289AccountMenu'))
   hoverTimer=setTimeout(()=>{if(!menu.matches(':hover')&&!menuTrigger?.matches(':hover'))closeMenu();},180);
});
""")
change("const account=q('#btnAccount');if(account){", """window.HC310?.avatar(q('#hc289PortalAccount'),window.hc289ClientSession?.user);
 const account=q('#btnAccount');if(account){window.HC310?.avatar(account,U());""")

# Patient search keeps a single modality selector and filters after choosing a date.
region("window.hc292Search=async function(initial={}){", " async function detail(p,mode,date)", """window.hc292Search=async function(initial={}){
 const main=q('#hc289PortalMain');if(!main)return;
 main.dataset.view='tele-search';window.hc310ReleaseBooking();
 const seq=++searchSerial;
 let directory={providers:[],paymentsReady:false};
 await window.HC310.booking(main,{
   initial, roles, options, money, dateKey, alive:()=>seq===searchSerial,
   privateDirectory:async()=>{const value=await api('directory');directory=value;return value;},
   institutionDirectory:()=>window.hc289PortalApi('directory'),
   getAvailability:(profiles,mode,date)=>api('availability',{providers:profiles.map(p=>p.username),mode,date}),
   getInstitutionSlots:(providerId,month)=>window.hc289PortalApi('calendar',{providerId,month}),
   bookInstitution:(providerId,slot,reason)=>window.hc289PortalApi('book',{providerId,startLocal:slot.local,reason,telemedicine:false}),
   detail:(provider,mode,date)=>detail(provider,mode,date)
 });
""")
change("function distance(i){", "window.hc310ReleaseBooking=()=>{bookingUI=null;};\nfunction distance(i){")
change("const officeReady=()=>mode!=='office'||directory.officePaymentsReady===true;const can=()=>reserve.disabled=reserving||!selected",
       """const address=box.querySelector('#hc310Address');
 const officeReady=()=>mode!=='office'||directory.officePaymentsReady===true;const can=()=>reserve.disabled=reserving||!selected||(address&&address.value.trim().length<5)""")
change("plan.onchange=load;q('#hc292Accept').onchange=can;", "plan.onchange=load;if(address)address.oninput=can;q('#hc292Accept').onchange=can;")
change("<label>Motivo de consulta<textarea id=\"hc292Reason\"", """'+(mode==='home'?'<label>Dirección del domicilio<input id="hc310Address" autocomplete="street-address" maxlength="500" required></label>':'')+'<label>Motivo de consulta<textarea id="hc292Reason\"""")
change("reason:q('#hc292Reason').value", "reason:q('#hc292Reason').value,homeAddress:address?.value.trim()")
change("mode==='office'?'Elegí el horario y la ubicación del consultorio.':'Atención por videollamada privada'", "mode==='office'?'Elegí el horario y la ubicación del consultorio.':mode==='home'?'Elegí el horario e indicá la dirección de la visita.':'Atención por videollamada privada'")
change("'Pagás '+money(r.amount_cents)+' por '+r.minutes+' minutos. Cualquier extensión se ofrece con precio y requiere tu aceptación y un nuevo pago.'",
       "'Pagás '+money(r.amount_cents)+' por '+r.minutes+' minutos.'+(mode==='telemedicine'?' Cualquier extensión requiere tu aceptación y un nuevo pago.':'')")
change("v.mode==='telemedicine'?'Telemedicina':'Consultorio Privado'", "window.HC310.modeLabel(v.mode)")
change("b.mode==='telemedicine'?'Telemedicina':'Consultorio Privado'", "window.HC310.modeLabel(b.mode)")
change("<b>Consultorio:</b> '+E(v.location_snapshot)", "<b>'+E(v.mode==='home'?'Domicilio':'Consultorio')+':</b> '+E(v.location_snapshot)")
change("'La consulta se paga completa antes de la videollamada. La pasarela distribuye el importe según la comisión configurada por Hospitalito.'", "mode==='home'?'El pago de la visita se realiza al reservar.':'La consulta se paga completa antes de la videollamada. La pasarela distribuye el importe según la comisión configurada por Hospitalito.'")
change("'Pago completo antes de la videollamada. Hospitalito: '", "(v.mode==='home'?'Pago completo al reservar la visita. Hospitalito: ':'Pago completo antes de la videollamada. Hospitalito: ')")

change("async function detail(p,mode,date){updateSteps(3);", "async function detail(p,mode,date){")
change("selected=null;updateSteps(2);box.replaceChildren();", "selected=null;box.replaceChildren();")
change("[data-tele-profile]')].find(b=>b.dataset.teleProfile===p.username)", "[data-result]')].find(b=>b.querySelector('b')?.textContent===p.name)")
change("institutionDirectory:()=>window.hc289PortalApi('directory'),",
       """institutionDirectory:async()=>{
   const [directory,profile]=await Promise.all([window.hc289PortalApi('directory'),window.hc289PortalApi('me')]);
   return {...directory,verifications:profile.verifications||[]};
 },
 verifyInstitution:id=>window.hc289PortalApi('requestVerification',{institutionId:id}),""")
change("!client&&v.mode==='office'&&((staged&&v.status==='active')||(!staged&&v.status==='confirmed'))",
       "!client&&v.mode!=='telemedicine'&&((staged&&v.status==='active')||(!staged&&v.status==='confirmed'))")
change("const el=dialog('Recordatorios de turnos','<p>Recibís un mensaje aquí 24 y 12 horas antes de cada turno confirmado. Los avisos se generan aunque tengas Hospitalito cerrado; los verás al ingresar. Este canal no envía WhatsApp ni correo.</p>",
       "const el=dialog('Avisos','<p>'+(window.hc289ClientSession?'Recibí aquí un aviso 24 horas antes de tus turnos confirmados.':'Acá aparecen las nuevas solicitudes de turno.')+'</p>")
change("""<button type="button" data-reminder-visit="'+E(n.payload?.visitId||'')+'">Ver mi turno</button>""",
       """<button type="button" data-reminder-visit="'+E(n.payload?.visitId||'')+'" data-institution-visit="'+E(n.payload?.bookingId||'')+'">Ver turno</button>""")
change("b.onclick=()=>window.hc292Visit(b.dataset.reminderVisit)", "b.onclick=()=>b.dataset.institutionVisit?window.hc310InstitutionVisit(b.dataset.institutionVisit):window.hc292Visit(b.dataset.reminderVisit)")
# Professional agenda: real dated bookings alongside the weekly availability editor.
change("if(!['telemedicine','office'].includes(mode))mode='telemedicine';", "if(!['telemedicine','office','home'].includes(mode))mode='telemedicine';")
change("if(!['telemedicine','office'].includes(mode))return;", "if(!['telemedicine','office','home'].includes(mode))return;")
change("mode==='office'?'Consultorio Privado · agenda y ubicaciones':'Telemedicina · agenda y tarifas'", "window.HC310.modeLabel(mode)+' · Agenda y tarifas'")
for old in ["E(mode==='office'?'Consultorio Privado':'Telemedicina')"]:
    page=page.replace(old, "E(window.HC310.modeLabel(mode))")
change("group.querySelectorAll('[data-private-mode]').forEach", """group.insertAdjacentHTML('beforeend','<button type="button" data-private-mode="home" class="institutionChoiceBtn"><b>Atención a Domicilio</b><span>Disponibilidad para visitas y tarifas</span></button>');
 group.querySelectorAll('[data-private-mode]').forEach""")
change("window.HC309.bindAgenda(f);const status=", """window.HC309.bindAgenda(f);
 window.HC310.professionalAgenda(el,mode);
 const status=""")
change("root.id='hc297Workspace';root.innerHTML=", "root.id='hc297Workspace';root.dataset.mode=mode;root.innerHTML=")
change('<button type="button" data-switch>Cambiar lugar de atención</button>', '<button type="button" data-pro-alerts>Avisos</button><button type="button" data-pro-profile aria-label="Perfil">Perfil</button><button type="button" data-switch>Cambiar lugar de atención</button>')
change(" $('[data-settings]',root).onclick=()=>window.hc292Professional(mode);",
       """ $('[data-settings]',root).onclick=()=>window.hc292Professional(mode);
 window.HC310.avatar($('[data-pro-profile]',root),user());
 $('[data-pro-profile]',root).onclick=()=>window.HC310.professionalProfile(mode,user());
 window.HC310.professionalAlerts(root);
 window.HC310.workspaceOpen=(id)=>{if(root.isConnected){document.querySelector('.hc310ProfessionalAgenda')?.closest('.hc289Dialog')?.remove();open(id);}};""")
change("main.innerHTML='<p role=\"status\">Abriendo consulta…</p>';", "main.innerHTML='<p role=\"status\">Abriendo consulta…</p>';visitPane.querySelector('[data-visit-back]').focus();")
change("j.history.map(n=>", "(j.history||[]).map(n=>")
change("<h2>Mis resultados</h2>", "<h2>Mis estudios</h2>")

change("""if (row) row.closest('form').querySelector('[data-day-tab="' + row.dataset.day + '"]')?.click();""",
       """if (row) {
      const form=row.closest('form');
      if(form.hc310SelectWeekday)form.hc310SelectWeekday(Number(row.dataset.day));
      else form.querySelector('[data-day-tab="' + row.dataset.day + '"]')?.click();
    }""")
change("window.hc292OpenVideo=async function(id){", "window.hc292OpenVideo=async function(id,host){")
change("document.body.append(root);activeRoom=root;", """const docked=host?.isConnected===true;
 if(docked){root.classList.add('hc310VideoDock');root.removeAttribute('aria-modal');}
 (docked?host:document.body).append(root);activeRoom=root;
 let detachObserver;""")
change("closed=true;connectionGen++;clearInterval(poll);", "closed=true;detachObserver?.disconnect();connectionGen++;clearInterval(poll);")
change("const escape=e=>{if(e.key==='Escape')cleanup();};", """if(docked){
   detachObserver=new MutationObserver(()=>{if(!root.isConnected)cleanup();});
   detachObserver.observe(document.body,{childList:true,subtree:true});
 }
 const escape=e=>{if(e.key==='Escape')cleanup();};""")
change("""(v.mode==='telemedicine'&&['confirmed','active'].includes(v.status)?'<button data-video>Comenzar videollamada</button>':'')""",
       """(v.mode==='telemedicine'&&['confirmed','active'].includes(v.status)?'<button class="hc289Primary" data-video>Abrir videollamada</button>':'')""")
change("""+'<button data-summary>Gestionar consulta</button></div><div data-notes></div>""",
       """+'<button data-summary>Gestionar consulta</button></div>'+(v.mode==='telemedicine'?'<section data-visit-video class="hc310VideoPanel"><h3>Videollamada</h3><p>La sala se habilita diez minutos antes de la consulta.</p><div data-video-room></div></section>':'')+'<div data-notes></div>""")
change("()=>window.hc292OpenVideo(id));$('[data-summary]',main)",
       "()=>window.hc292OpenVideo(id,$('[data-video-room]',main)));$('[data-summary]',main)")
# Keep account navigation, alerts and the reservation quote consistent.
change("async function clientAccount(section){",
    "async function clientAccount(section,inSettings=false){\n const panel=(title,content)=>{\n   if(!inSettings&&section!=='settings')return dialog(title,content);\n   const el=dialog(title,window.HC310.settingsMarkup(content,section));\n   window.HC310.bindSettings(el,key=>clientAccount(key,true));\n   return el;\n };")
change("const el=dialog('Seguridad de la cuenta',",
    "const el=panel('Seguridad de la cuenta',")
change("const el=dialog('Perfil','<div style=\"text-align:center\">",
    "const el=panel('Perfil','<div style=\"text-align:center\">")
change("const el=dialog('Configuración',window.HC310.settingsMarkup(window.hc289Personalization()));window.hc289PersonalizeRefresh=()=>{const page=el.querySelector('.hcSettingsPage');if(page)page.outerHTML=window.hc289Personalization();};window.HC310.bindSettings(el,section=>window.hc289ClientAccount(section));",
    "const el=panel('Configuración',window.hc289Personalization());\n const previous=window.hc289PersonalizeRefresh;\n window.hc289PersonalizeRefresh=()=>{\n  const page=el.querySelector('.hcSettingsPage');\n  if(el.isConnected&&page)page.outerHTML=window.hc289Personalization();\n  else previous?.();\n };")
page = page.replace("#btnAccount,#hc289PortalAccount",
    "#btnAccount,#hc289PortalAccount,[data-pro-profile]")
change("menu.innerHTML=entries.filter",
    "const workspace=button.closest('#hc297Workspace');\n const accountEntries=workspace?[['Perfil','account'],['Avisos','notifications'],['Configuración','settings'],['SALIR','logout']]:\n   session&&!session.localSeed&&!client&&window.hc297IsProfessional?.(U())?[...entries,['Solicitudes de turno','booking-alerts']]:entries;\n menu.innerHTML=accountEntries.filter")
change("['account', 'notifications', 'security', 'settings']",
    "['account', 'booking-alerts', 'notifications', 'security', 'settings']")
change("if(!id)return;closeMenu();if(window.hc289ClientSession){",
    "if(!id)return;const workspace=menuTrigger?.closest('#hc297Workspace');closeMenu();\n if(workspace){workspace.hc310Account(id);return;}\n if(id==='booking-alerts'){window.hc296Notifications();return;}\n if(window.hc289ClientSession){")
change("closeMenu();if(window.hc289ClientSession)window.hc289ClientAccount('account');",
    "closeMenu();const workspace=account.closest('#hc297Workspace');\n  if(workspace)workspace.hc310Account('account');\n  else if(window.hc289ClientSession)window.hc289ClientAccount('account');")
change("apply();window.hc289StaffDecorate?.();",
    "apply();window.hc289StaffDecorate?.();\n if(session&&!session.localSeed&&!window.hc289ClientSession&&localStorage.getItem(LS.globalAuthToken)&&window.hc297IsProfessional?.(U()))\n   window.HC310?.professionalAlerts(U());")
change("if(attempt!==slotSerial||!plan.isConnected)return;revision=j.profileRevision;",
    "if(attempt!==slotSerial||!plan.isConnected)return;\n if(p.revision!=null&&j.profileRevision!==p.revision){\n   q('#hc292Slots').textContent='El profesional actualizó sus tarifas u horarios. Presioná Buscar para verlos antes de reservar.';\n   return;\n }\n revision=j.profileRevision;")
change("data-institution-visit=\"'+E(n.payload?.bookingId||'')+'\">Ver turno",
    "data-institution-visit=\"'+E(n.payload?.bookingId||'')+'\" data-visit-mode=\"'+E(n.payload?.mode||'')+'\">Ver turno")
change("b.onclick=()=>b.dataset.institutionVisit?window.hc310InstitutionVisit(b.dataset.institutionVisit):window.hc292Visit(b.dataset.reminderVisit)",
    "b.onclick=()=>{\n  if(b.dataset.institutionVisit)return window.hc310InstitutionVisit(b.dataset.institutionVisit);\n  if(window.hc289ClientSession||!b.dataset.visitMode)return window.hc292Visit(b.dataset.reminderVisit);\n  el.remove();window.HC310.openProfessionalVisit(b.dataset.reminderVisit,b.dataset.visitMode);\n }")
change("await api('readNotifications',{ids:messages.filter(n=>!n.read_at).map(n=>n.id)});await refresh();",
    "await api('readNotifications',{ids:messages.filter(n=>!n.read_at).map(n=>n.id)});await refresh();\n if(!window.hc289ClientSession)window.HC310.professionalAlerts(JSON.parse(localStorage.getItem(LS.globalAuthUser)||'{}'),true);")
change("data-pro-profile aria-label=\"Perfil\">Perfil",
    "data-pro-profile aria-label=\"Perfil\" aria-haspopup=\"menu\" aria-expanded=\"false\">Perfil")
change(" $('[data-pro-profile]',root).onclick=()=>window.HC310.professionalProfile(mode,user());\n window.HC310.professionalAlerts(root);",
    " root.hc310Account=section=>{\n   if(section==='logout')return $('[data-exit]',root).click();\n   if(section==='notifications')return window.hc296Notifications();\n   return window.HC310.professionalProfile(mode,user(),section);\n };\n $('[data-pro-alerts]',root).onclick=()=>window.hc296Notifications();\n const alertTimer=setInterval(()=>{if(!root.isConnected)clearInterval(alertTimer);else window.HC310.professionalAlerts(user());},5000);\n window.HC310.professionalAlerts(user());")

change("if(!window.hc289ClientSession)window.HC310.professionalAlerts(JSON.parse(localStorage.getItem(LS.globalAuthUser)||'{}'),true);",
    "if(window.hc289ClientSession)q('#hc289Portal')?.hc310RefreshReminders?.();\n else window.HC310.professionalAlerts(JSON.parse(localStorage.getItem(LS.globalAuthUser)||'{}'),true);")

assets = ['ui/v310.css', 'ui/v310.js']
insertion = ''.join(
    f'<{tag} id="hc-v310-{kind}">\n{(root / file).read_text(encoding="utf-8")}\n</{tag}>\n'
    for file, tag, kind in zip(assets, ['style', 'script'], ['styles', 'ui'])
)
end = page.rindex('</body>')
page = page[:end] + insertion + page[end:]
for filename in ['index.html', 'Hospitalito_v310.html']:
    (root / filename).write_text(page, encoding="utf-8", newline="\n")
