"""Build the v314 entry points from the standalone v313 release."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / "Hospitalito_v313.html").read_text(encoding="utf-8")


def change(old, new, count=1):
    global page
    found = page.count(old)
    if found != count:
        raise ValueError(f"Expected {count} v313 matches, found {found}: {old[:130]}")
    page = page.replace(old, new)


def region(start, end, value):
    a = page.index(start)
    b = page.index(end, a)
    change(page[a:b], value)


for old,new in [
    ("CURRENT_VERSION = 313;", "CURRENT_VERSION = 314;"),
    ("<title>Hospitalito v313", "<title>Hospitalito v314"),
    ('window.HC_DEMO_VERSION="v313";document.title="Hospitalito · Historia Clínica Digital · v313";',
     'window.HC_DEMO_VERSION="v314";document.title="Hospitalito · Historia Clínica Digital · v314";'),
    ('<span id="hc307Version">v313</span>', '<span id="hc307Version">v314</span>'),
    ('>Hospitalito <small>v313</small>', '>Hospitalito <small>v314</small>'),
    ("""right:'<path d="m9 6 6 6-6 6"/>'""","""right:'<path d="m9 6 6 6-6 6"/>',down:'<path d="m6 9 6 6 6-6"/>'"""),
]:
    change(old,new)

change(r"const src = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)",
       r"const src = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(photo)")

# A single display/edit component feeds each account's existing profile API.
region("  function renderAccount(){","  function renderPrivacy(){", """  function renderAccount(){
    const u=currentUser(),user={...u,username:meName(),name:u.name||session?.name||meName()};
    const fields=window.HC314.accountFields(user,roleLabel(session?.role||u.role),currentInstitutionName());
    fields.push({key:"theme",label:"Tema",value:THEME_DEFS[userTheme(u)]?.label});
    const page=document.getElementById("hcSettingsContent");
    queueMicrotask(()=>{
      if(page.querySelector('[data-hc314-profile-page]'))window.HC314.bindProfile(page,fields,(field,value)=>window.HC314.saveAccountField(user,field,value));
    });
    return `<div class="hcSettingsPage" data-hc314-profile-page><h2>Perfil</h2>
      <div class="hcSettingsGrid"><div class="hcSettingsCard">${window.HC314.profileRows(fields)}
        <div class="hcSettingsActions"><button type="button" class="hcSettingsBtn hc314Ghost" id="hcsOpenClassicAccount">Abrir Cuenta clásica</button></div>
      </div></div></div>`;
  }
""")
region("  async function saveProfile(){","  async function changePasswordNew(){","")
change('    if(ev.target.closest?.("#hcsSaveProfile")){await saveProfile();return;}\n','')
change('    if(ev.target.id==="hcsProfilePhoto"){const f=ev.target.files?.[0]||null;pendingProfilePhoto=f||null;return;}\n','')
change('  let pendingProfilePhoto=null;\n','')
change('if(ev.key==="Escape"&&document.getElementById("hcSettingsModal")?.classList.contains("show"))',
       'if(ev.key==="Escape"&&!ev.target.closest?.("[data-hc314-editor]")&&document.getElementById("hcSettingsModal")?.classList.contains("show"))')
change("if(b.closest('#medHistoria,#medScales,#hc270PatientSearch,#hc280Security,#hc280Lock'))",
       "if(b.closest('#medHistoria,#medScales,#hc270PatientSearch,#hc280Security,#hc280Lock,[data-hc314-profile]'))")
change('anchor=$("#hcsProfileName")', 'anchor=$("[data-hc314-profile-page]")')
change('#hcSettingsContent:has(#hcsProfileName)', '#hcSettingsContent:has([data-hc314-profile-page])')
region('.hcSettingsPage:has(#hcsProfileName) .hcSettingsGrid', '\n', """[data-hc314-profile-page] .hcSettingsGrid{grid-template-columns:minmax(0,840px);justify-content:center}""")

change("async function clientAccount(section,inSettings=false){","async function clientAccount(section){")
change("   if(!inSettings&&section!=='settings')return dialog(title,content,{fullscreen:true});\n","")
change("   window.HC310.bindSettings(el,key=>window.hc289ClientAccount(key,true));",
       """   el.classList.add('hc314Settings');
   window.HC310.bindSettings(el,window.hc289ClientAccount);""")
change("if(section==='settings'){panel('Configuración',window.hc289Personalization());",
       "if(section==='settings'){panel('Apariencia',window.hc289Personalization());")
region(" if(!me)await refresh();\n if(opening!==accountRequest", "window.hc289ClientAccount=clientAccount;", """ if(!me)await refresh();
 if(opening!==accountRequest||owner!==window.hc289ClientSession?.token)return;
 const account=window.hc289ClientSession;
 if(!account)return;
 const client=me?.client;
 const profile=client?.profile||{};
 const fields=[
   {key:'name',label:'Nombre completo',value:client?.legal_name||account.user.name},
   {key:'username',label:'Usuario',value:account.user.username},
   {key:'role',label:'Rol',value:'Paciente'},
   {key:'dni',label:'DNI',value:client?.dni},
   {key:'dob',label:'Fecha de nacimiento',value:window.HC313.date(client?.dob)},
   {key:'address',label:'Dirección',value:profile.address,editable:!!client,max:500,autocomplete:'street-address'},
   {key:'phone',label:'Teléfono',value:profile.phone,editable:!!client,type:'tel',max:80,autocomplete:'tel'},
   {key:'email',label:'Correo electrónico',value:profile.email,editable:!!client,type:'email',autocomplete:'email'},
   {key:'location',label:'Ubicación',value:profile.latitude!=null?'Ubicación guardada':'Sin ubicación guardada',editable:!!client,type:'location'},
   {key:'photo',label:'Foto de perfil',value:account.user.photo,type:'photo',editable:true}
 ];
 const documents='<section class="hc314ProfileExtra"><h3>Fotos de mi DNI</h3><p id="hc290MyDocumentStatus" role="status"></p><div id="hc290MyDocuments" class="hc290DocumentGallery"></div></section>';
 const verifications=(me?.verifications||[]).map(v=>'<p>'+E(directory.institutions.find(i=>i.id===v.institution_id)?.name||v.institution_id)+' · '+E(({pending:'Pendiente',verified:'Verificada',rejected:'Rechazada',revoked:'Revocada'})[v.status])+'</p>').join('');
 const el=panel('Perfil',window.HC314.profileRows(fields)+'<p class="hc289Notice">Los cambios de identidad requieren una nueva revisión institucional.</p>'+
   (!client?'<p role="status">No se pudieron cargar tus datos personales. <button type="button" class="hc314Ghost" data-reload-profile>Reintentar</button></p>':'')+
   documents+'<section class="hc314ProfileExtra"><h3>Verificaciones por institución</h3>'+(verifications||'<p>Sin verificaciones registradas.</p>')+'</section>');
 const retry=el.querySelector('[data-reload-profile]');
 if(retry)retry.onclick=()=>window.hc289ClientAccount('account');
 loadPersonalDocuments(el);
 window.HC314.bindProfile(el,fields,async(field,value)=>{
   const sameSession=()=>window.hc289ClientSession?.token===owner;
   const requireSession=()=>{if(!sameSession())throw Error('Cambió la sesión. Volvé a abrir el perfil.');};
   requireSession();
   if(field.key==='photo'){
     const saved=await window.hc230AuthRequest('updateProfile',{token:owner,user:{photo:value}});
     requireSession();
     if(saved.user?.username!==account.user.username||saved.user.photo!==value)throw Error('No se confirmó la foto de perfil.');
     const current=window.hc289ClientSession;
     current.user={...current.user,...saved.user};
     localStorage.setItem('hc289.client',JSON.stringify(current));
     window.HC310.avatar(q('#hc289PortalAccount'),current.user);
     return current.user.photo;
   }
   const coordinates=field.key==='location'?await geo():null;
   requireSession();
   const latest=await api('me');
   requireSession();
   if(!latest.client)throw Error('No se pudieron comprobar los datos personales.');
   const {address='',phone='',email='',latitude=null,longitude=null}=latest.client.profile||{};
   const patch={address,phone,email,latitude,longitude,...(coordinates||{[field.key]:value})};
   const saved=await api('updateClientProfile',{profile:patch});
   requireSession();
   if(!saved.client)throw Error('No se confirmó el cambio de perfil.');
   requestSerial++;me=saved;
   const result=saved.client.profile||{};
   position=result.latitude!=null?{latitude:result.latitude,longitude:result.longitude}:null;
   return field.key==='location'?(position?'Ubicación guardada':'Sin ubicación guardada'):result[field.key];
 });
}
""")
change("window.hc289ClientAccount=async function(section,inSettings){await base(section,inSettings);",
       "window.hc289ClientAccount=async function(section){await base(section);")
region("  function professionalProfile(mode,user,section='account') {","  function openProfessionalVisit(", """  function professionalProfile(mode,user,section='account') {
    const titles={account:'Perfil',settings:'Apariencia',agenda:'Agenda y tarifas'};
    if(section==='agenda')return window.hc292Professional(mode);
    const fresh=loadJSON(LS.globalAuthUser,{});
    if(fresh?.username===user.username)user={...user,...fresh};
    const fields=window.HC314.accountFields(user,window.hc292Tele.roles[user.role]||user.role);
    const content=section==='account'?window.HC314.profileRows(fields):window.hc289Personalization();
    const el=window.hc289Dialog(titles[section],settingsMarkup(content,section,titles));
    bindSettings(el,key=>professionalProfile(mode,user,key));
    if(section==='account')window.HC314.bindProfile(el,fields,(field,value)=>window.HC314.saveAccountField(user,field,value));
  }

""")

change("status.textContent=j.documents?.some(d=>d.side==='back')?",
       "status.textContent=!j.documents?.length?'Todavía no hay fotos de DNI guardadas.':j.documents.some(d=>d.side==='back')?")

# The calendar is the neutral state of the portal shortcuts.
change("root.dataset.view='calendar';window.HC311.markPortal('turns');","root.dataset.view='calendar';window.HC311.markPortal(null);")
change("      window.HC311.markPortal(button.dataset.portalSection);",
       """      if(button.getAttribute('aria-current')==='page')return actions.home();
      window.HC311.markPortal(button.dataset.portalSection);""")
change(""" root.innerHTML='<div class="hc305AppointmentsHead"><h2>Mis turnos</h2><button type="button" data-hc305-refresh '+(loading?'disabled':'')+'>Actualizar</button></div><p class="hc289Notice">""",
       """ root.innerHTML=window.HC314.sectionHeader('Mis Turnos','<button type="button" class="hc314Ghost" data-hc305-refresh '+(loading?'disabled':'')+'>Actualizar</button>')+'<p class="hc289Notice">""")
change("""main().innerHTML='<button data-289-back>‹ Calendario</button><h2>Mis estudios</h2>'+""",
       """main().innerHTML=window.HC314.sectionHeader('Mis Estudios')+""")
change("""    root.innerHTML = '<h2>Mis Recetas</h2><p role="status">""",
       """    root.innerHTML = window.HC314.sectionHeader('Mis Recetas')+'<p role="status">""")
change("if(b.hasAttribute('data-289-back')){calendarView();refresh();}",
       """if(b.hasAttribute('data-hc314-close-section')){calendarView();main().querySelector('.hc310CalendarViewport')?.focus({preventScroll:true});return;}if(b.hasAttribute('data-289-back')){calendarView();refresh();}""")

# Cuenta opens Configuración → Perfil on each input device. Touch also has a menu trigger.
change('class="hc289PortalWho">\'+E(user.name)+\'</span><button id="hc289PortalAccount" type="button" aria-haspopup="menu">Perfil</button></header>',
       'class="hc289PortalWho">\'+E(user.name)+\'</span><div class="hc314AccountActions"><button id="hc289PortalAccount" type="button" aria-haspopup="menu">Perfil</button>'+
       '<button id="hc314AccountMenuTrigger" type="button" class="hc314Ghost hc312IconOnly" aria-haspopup="menu" aria-expanded="false" aria-label="Opciones de cuenta" title="Opciones de cuenta">\'+window.hc289Icon(\'down\')+\'</button></div></header>')
change("const account=e.target.closest('#btnAccount,#hc289PortalAccount,[data-pro-profile]');if(account){e.preventDefault();e.stopImmediatePropagation();",
       """const account=e.target.closest('#btnAccount,#hc289PortalAccount,#hc314AccountMenuTrigger,[data-pro-profile]');if(account){e.preventDefault();e.stopImmediatePropagation();
 if(account.id==='hc289PortalAccount'){closeMenu();window.hc289ClientAccount('account');return;}
 if(account.id==='hc314AccountMenuTrigger'){
  if(!menu.hidden&&menuTrigger===account)closeMenu();else openMenu(account);
  return;
 }""")
change("'#hc289AccountMenu,#btnAccount,#hc289PortalAccount,[data-pro-profile]'", "'#hc289AccountMenu,#btnAccount,#hc289PortalAccount,#hc314AccountMenuTrigger,[data-pro-profile]'")
change("const trigger=e.target.closest('#btnAccount,#hc289PortalAccount,[data-pro-profile]');",
       "const trigger=e.target.closest('#btnAccount,#hc289PortalAccount,#hc314AccountMenuTrigger,[data-pro-profile]');")

# Local examples keep their values and update at the start of each minute.
region("  function settingsMarkup() {\n    const current=preferences();", "  window.HC313 =", """  function examples(now) {
    const dateParts=parts(now,{timeZone:argentina});
    return {
      dateFormat:[['dmy',formatDate(dateParts,{dateFormat:'dmy'})],['iso',formatDate(dateParts,{dateFormat:'iso'})]],
      timeFormat:[['24h',formatTime(dateParts,{timeFormat:'24h'})+' (24 horas)'],['12h',formatTime(dateParts,{timeFormat:'12h'})+' (12 horas)']]
    };
  }

  let exampleTimer;
  function refreshExamples() {
    clearTimeout(exampleTimer);
    const options=document.querySelectorAll('#hcSettingsModal.show .hc313Format select,#hc289Dialog .hc313Format select');
    if(!options.length)return;
    const current=examples(new Date());
    options.forEach(select=>{
      current[select.dataset.hc313Format]?.forEach(([value,label])=>{
        const option=select.querySelector('option[value="'+value+'"]');
        if(option&&option.textContent!==label)option.textContent=label;
      });
    });
    exampleTimer=setTimeout(refreshExamples,60030-Date.now()%60000);
  }

  function settingsMarkup(now=new Date()) {
    const current=preferences(), choices=examples(now);
    const select=name=>'<select data-hc313-format="'+name+'">'+choices[name].map(([value,label])=>
      '<option value="'+value+'"'+(value===current[name]?' selected':'')+'>'+label+'</option>').join('')+'</select>';
    if(typeof document!=='undefined'){
      clearTimeout(exampleTimer);
      exampleTimer=setTimeout(refreshExamples,60030-Date.now()%60000);
    }
    return '<fieldset class="hc313Format"><legend>Fecha y hora</legend><div>'+
      '<label>Formato de fecha'+select('dateFormat')+'</label>'+
      '<label>Formato de hora'+select('timeFormat')+'</label>'+
      '</div></fieldset>';
  }

  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshExamples();});

""")

script=(root / "ui/v314.js").read_text(encoding="utf-8")
style=(root / "ui/v314.css").read_text(encoding="utf-8")
change('<script id="hc-v313-formats">',
       f'<script id="hc-v314-profile">\n{script}</script>\n<script id="hc-v313-formats">')
change("</body>\n</html>",f'<style id="hc-v314-styles">\n{style}</style>\n</body>\n</html>')
for filename in ('index.html','Hospitalito_v314.html'):
    (root / filename).write_text(page,encoding="utf-8")
