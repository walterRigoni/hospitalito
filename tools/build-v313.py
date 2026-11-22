"""Build the standalone v313 release from v312."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / "Hospitalito_v312.html").read_text(encoding="utf-8")


def change(old, new, count=1):
    global page
    found = page.count(old)
    if found != count:
        raise ValueError(f"Expected {count} v312 matches, found {found}: {old[:150]}")
    page = page.replace(old, new)


def replace_function(start, end, replacement):
    a = page.index(start)
    b = page.index(end, a)
    change(page[a:b], replacement)


for old,new in [
    ("CURRENT_VERSION = 312;", "CURRENT_VERSION = 313;"),
    ("<title>Hospitalito v312", "<title>Hospitalito v313"),
    ('window.HC_DEMO_VERSION="v312";document.title="Hospitalito · Historia Clínica Digital · v312";',
     'window.HC_DEMO_VERSION="v313";document.title="Hospitalito · Historia Clínica Digital · v313";'),
    ('<span id="hc307Version">v312</span>', '<span id="hc307Version">v313</span>'),
    ('>Hospitalito <small>v312</small>', '>Hospitalito <small>v313</small>'),
]:
    change(old,new)

# Institutional staff, private professionals and patients share Personalización.
change("const U=()=>window.hc289ClientSession?.user||(typeof getCurrentUser==='function'?getCurrentUser():{})||{},name=()=>U().username||session?.username||'local';",
       """const U=()=>{
 const client=window.hc289ClientSession?.user;if(client)return client;
 const current=getCurrentUser?.(),saved=loadJSON(LS.globalAuthUser,{})||{};
 if(current?.username)return saved.username===current.username?{...saved,...current}:current;
 return q('#hc297Workspace')?saved:{};
},name=()=>U().username||session?.username||'local';""")
change("'+window.HC311.fontPicker(fonts,v.font)+'<p>Vista previa:",
       "'+window.HC311.fontPicker(fonts,v.font)+window.HC313.settingsMarkup()+'<p>Vista previa:")
change("document.addEventListener('change',e=>{if(e.target.matches('[data-vfont]')){",
       """document.addEventListener('change',e=>{
 const format=e.target.dataset?.hc313Format;
 if(format){
   const options={dateFormat:['dmy','iso'],timeFormat:['24h','12h']};
   if(options[format]?.includes(e.target.value)){
     const panel=e.target.closest('.hcSettingsPage').parentElement;
     saveVisual({[format]:e.target.value});
     panel.querySelector('[data-hc313-format='+format+']')?.focus();
   }
 }
 if(e.target.matches('[data-vfont]')){""")

change("function apply(){const v=visual(),p=palette(v);",
       "function apply(){const v=visual(),p=palette(v);window.HC313.setPreferences(v);")
change("},name=()=>U().username||session?.username||'local';",
       """},name=()=>U().username||session?.username||'local';
window.hc313Viewer=()=>window.hc289ClientSession?.user.username||session?.username||q('#hc297Workspace')?.dataset.hc313Viewer||'local';""")
change("root.id='hc297Workspace';root.dataset.mode=mode;",
       "root.id='hc297Workspace';root.dataset.mode=mode;root.dataset.hc313Viewer=workspaceOwner;")
change("function personalization(){const v=visual();", "function personalization(){const v=visual();window.HC313.setPreferences(v);")

replace_function("async function saveVisual(patch){","function personalization()", """let visualSync=Promise.resolve();
async function saveVisual(patch){
 const user=U(),v={...visual(),...patch},owner=user.username;
 localStorage.setItem('hc289.visual.'+name(),JSON.stringify(v));
 apply();window.hc289PersonalizeRefresh?.();
 const activeToken=()=>window.hc289ClientSession?.token||(!session?.localSeed&&localStorage.getItem(LS.globalAuthToken));
 const token=activeToken();
 if(!token)return;
 const prefs={...(user.preferences||{}),visual:v};
 visualSync=visualSync.then(async()=>{
  if(activeToken()!==token)return;
  try{
   const j=await window.hc230AuthRequest('updateProfile',{token,user:{preferences:prefs}});
   if(activeToken()!==token)return;
   const client=window.hc289ClientSession;
   if(client){client.user={...client.user,...j.user};localStorage.setItem('hc289.client',JSON.stringify(client));}
   else {
    const old=loadJSON(LS.globalAuthUser,{});
    if(old?.username===owner)saveJSON(LS.globalAuthUser,{...old,...j.user});
   }
  }catch(e){if(activeToken()===token)window.hc289Toast('Preferencia guardada en este equipo. No se pudo sincronizar.');}
 });
 await visualSync;
}
""")
change("     saveVisual({[format]:e.target.value});",
       "     saveVisual({[format]:e.target.value});\n     document.dispatchEvent(new Event('hc313FormatChanged'));document.querySelector('#hc297Workspace')?.dispatchEvent(new Event('hc313FormatChanged'));")
change("window.hc310ReleaseBooking=()=>{bookingUI=null;};",
       """window.hc310ReleaseBooking=()=>{bookingUI=null;};
document.addEventListener('hc313FormatChanged',()=>{
 if(!window.hc289ClientSession||locked)return;
 registry();
 if(main()?.dataset.view==='appointments')appointmentsView();
});""")
change(" const visitPane=$('main',root);",
       """ const visitPane=$('main',root);
 root.addEventListener('hc313FormatChanged',()=>renderList());""")

# Display formatting never changes date keys, form values, server payloads or sort order.
replace_function("function nowStr(){", "function isoFromNow(){", """function nowStr(){ return window.HC313.dateTime(nowDateObj()); }
function dmyFromDateISO(iso){ return window.HC313.date(iso); }
function dmyhmFromISODateTime(iso){ return window.HC313.dateTime(iso); }
function hm24FromISO(iso){ return window.HC313.time(iso); }
""")
replace_function("function fmtDateTimeShort(iso){", "function getSVPreviewData", """function fmtDateTimeShort(iso){
  const value=iso?new Date(iso):null;
  return window.HC313.dateTime(value)||"—";
}

""")
replace_function("function hc270Date(v){","function hc270Time(v)", """function hc270Date(v){
  return window.HC313.dateTime(v,{timeZone:window.HC313.argentina})||String(v||"Fecha no registrada");
}
""")
for old,new in [
    ("dmyFromDateISO(p.day).slice(0,5)","window.HC313.date(p.day,{short:true})"),
    ('dmyhmFromISODateTime(x.at||"").split(" ")','[window.HC313.date(x.at),window.HC313.time(x.at)]'),
    ('new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})','window.HC313.time(new Date(),{seconds:true})'),
    ("new Date(v).toLocaleString('es-AR')","window.HC313.dateTime(new Date(v))"),
    ("new Date(v).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})","window.HC313.dateTime(new Date(v),{short:true})"),
    ("x?new Date(x).toLocaleDateString('es-AR'):'—'","window.HC313.date(x,{timeZone:window.HC313.argentina})||'—'"),
    ("function formatDate(iso){const [year,month,day]=iso.split('-');return day+'/'+month+'/'+year;}","function formatDate(iso){return window.HC313.date(iso);}"),
    ("new Date(appointmentSync.updatedAt).toLocaleTimeString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hour:'2-digit',minute:'2-digit'})","window.HC313.time(appointmentSync.updatedAt,{timeZone:window.HC313.argentina})"),
    ("new Date(key+'T12:00').toLocaleDateString('es-AR',{dateStyle:'full'})","window.HC313.dayLabel(key)"),
    ("new Date(b.ends_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})","window.HC313.dateTime(b.ends_at,{timeZone:window.HC313.argentina})"),
    ("const dayLabel = key => toDate(key).toLocaleDateString('es-AR', {dateStyle:'full'});","const dayLabel = key => window.HC313.dayLabel(key);"),
    ("""const time = date => new Date(date).toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', hour:'2-digit', minute:'2-digit', hour12:false
  });""","const time = date => window.HC313.time(date,{timeZone:window.HC313.argentina});"),
    ("date.toLocaleDateString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})","window.HC313.date(date,{timeZone:window.HC313.argentina})"),
    ("E(dateKey())","E(window.HC313.date(dateKey()))"),
    ("E(v.client?.dob)","E(window.HC313.date(v.client?.dob))"),
    ("E(p.dob)+'</p><p","E(window.HC313.date(p.dob))+'</p><p"),
    ("E(a.date)+'</p><pre","E(window.HC313.dateTime(a.date))+'</p><pre"),
    ("'+E(day)+'</h4><label>Desde","'+E(window.HC313.date(day))+'</h4><label>Desde"),
    ("E(s.local.slice(-5))","E(window.HC313.time(s.local))"),
    ("E(slot.local.slice(-5))","E(window.HC313.time(slot.local))"),
    ('${escHTML(x.date||"—")}</div>', '${escHTML(window.HC313.dateTime(x.date)||"—")}</div>'),
    ('Turno ${consultAppt.time || "—"}','Turno ${window.HC313.time(consultAppt.time) || "—"}'),
    ('${consultAppt.time || ""} •','${window.HC313.time(consultAppt.time)} •'),
    ('left.textContent = \x60${a.time || "—"} •','left.textContent = \x60${window.HC313.time(a.time) || "—"} •'),
    ('${escHTML(decisionTime||item.time||"—")}','${escHTML(window.HC313.time(decisionTime||item.time)||"—")}'),
    ('${escHTML(next.time || "")}','${escHTML(window.HC313.time(next.time))}'),
    ('${escHTML(appt?.time || "—")}','${escHTML(window.HC313.time(appt?.time)||"—")}'),
    ('${dmyFromDateISO(dateISO)} ${time}${room','${dmyFromDateISO(dateISO)} ${window.HC313.time(time)}${room'),
    ('• Inicio: ${form.startTime||"—"} • Fin: ${form.endTime||"—"}','• Inicio: ${window.HC313.time(form.startTime)||"—"} • Fin: ${window.HC313.time(form.endTime)||"—"}'),
    ('escHTML(r.form?.startTime||"")','escHTML(window.HC313.time(r.form?.startTime))'),
    ("m.time?' '+esc(m.time):''","m.time?' '+esc(window.HC313.time(m.time)):''"),
    ('${state.dueSlot.at.slice(11,16)}','${window.HC313.time(state.dueSlot.at)}'),
    ('${slot.at.slice(11,16)}','${window.HC313.time(slot.at)}'),
    ('String(dueSlot.at || "").slice(11,16)','window.HC313.time(dueSlot.at)'),
    ('String(nextSlot.at || "").slice(11,16)','window.HC313.time(nextSlot.at)'),
    ('String(lastRecordedSlot.at || "").slice(11,16)','window.HC313.time(lastRecordedSlot.at)'),
]:
    change(old,new)

change("new Date(s).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',dateStyle:'short',timeStyle:'short'})",
       "window.HC313.dateTime(s,{timeZone:window.HC313.argentina})")
change("new Date(iso).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',dateStyle:'short',timeStyle:'short'})",
       "window.HC313.dateTime(iso,{timeZone:window.HC313.argentina})")
change("new Date(b.starts_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})",
       "window.HC313.dateTime(b.starts_at,{timeZone:window.HC313.argentina})",2)
change('class="agendaSlotTime">${escHTML(slot.time)}','class="agendaSlotTime">${escHTML(window.HC313.time(slot.time))}',4)
change('${escHTML(a.time || "—")}','${escHTML(window.HC313.time(a.time)||"—")}',2)
change('${escHTML(item.time||"—")}','${escHTML(window.HC313.time(item.time)||"—")}',2)
change('${escHTML(a.time||"—")}','${escHTML(window.HC313.time(a.time)||"—")}')
change('String(slot.at || "").slice(11,16)','window.HC313.time(slot.at)',3)
for edge in ('start','end'):
    day=f'x.{edge}Date||x.dateLocal'
    hour=f'x.{edge}Time'
    change(f'esc(({day}||"—")+" "+({hour}||"—"))',
           f'esc((window.HC313.date({day})||"—")+" "+(window.HC313.time({hour})||"—"))')
    change('esc('+day+'||"—")} ${esc('+hour+'||"—")',
           'esc(window.HC313.date('+day+')||"—")} ${esc(window.HC313.time('+hour+')||"—")')

change("new Date(o.created_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})",
       "window.HC313.dateTime(o.created_at,{timeZone:window.HC313.argentina})")
change("new Date(state.ultimaConfirmacionClinica).toLocaleTimeString()",
       "window.HC313.time(new Date(state.ultimaConfirmacionClinica))")
change('<html lang="es">','<html lang="es-AR">',5)
change('    const label=hc270Label(key);\n    html+=typeof item',
       """    const label=hc270Label(key);
    const dated=typeof item==='string'&&/^(?:date|time|dob|at|ts|fecha|hora|[a-zA-Z]+(?:Date|Time|At)|[a-z_]+_(?:date|time|at))$/.test(key);
    const value=dated?window.HC313.dateTime(item,{timeZone:window.HC313.argentina})||item:item;
    html+=typeof item""")
change('${hc270ValueHTML(item)}</div>','${hc270ValueHTML(value)}</div>')
change('window.HC313.dateTime(new Date(v),{short:true})', 'window.HC313.dateTime(new Date(v))')
change('function hcMedicationClockLabel(value){ return value==="00:00" ? "24:00" : value; }',
       'function hcMedicationClockLabel(value){ return window.HC313.time(value); }')
change("E(r.date)+'</p><pre", "E(window.HC313.dateTime(r.date))+'</p><pre")
change('>Mañana 06:00–14:00</option>', '>Mañana ${window.HC313.time("06:00")}–${window.HC313.time("14:00")}</option>')
change('>Tarde 14:00–22:00</option>', '>Tarde ${window.HC313.time("14:00")}–${window.HC313.time("22:00")}</option>')
change('>Noche 22:00–06:00</option>', '>Noche ${window.HC313.time("22:00")}–${window.HC313.time("06:00")}</option>')

change("'+slot.local.slice(-5)+", "'+E(window.HC313.time(slot.local))+")
change("Horarios · '+E(date)", "Horarios · '+E(window.HC313.date(date))")

script=(root / "ui/v313.js").read_text(encoding="utf-8")
style=(root / "ui/v313.css").read_text(encoding="utf-8")
change('<script id="hc-v286-diet-helpers">',
       f'<script id="hc-v313-formats">\n{script}</script>\n<script id="hc-v286-diet-helpers">')
change("</body>\n</html>", f'<style id="hc-v313-styles">\n{style}</style>\n</body>\n</html>')
for name in ('index.html','Hospitalito_v313.html'):
    (root / name).write_text(page,encoding="utf-8")
