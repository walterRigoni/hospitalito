from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
s=Path('Hospitalito_v298.html').read_text()
def rep(a,b):
 global s
 assert a in s,a[:140]
 s=s.replace(a,b)
rep('Hospitalito v298','Hospitalito v299');rep("HC_DEMO_VERSION='v298'","HC_DEMO_VERSION='v299'");rep('HC Demo v298','HC Demo v299')
rep('<button class="btn small" id="hc229ShiftClose" type="button">Cerrar</button>','<button class="btn small" id="hc299ShiftLogin" type="button" title="Volver al ingreso" aria-label="Volver al ingreso de usuario y contraseña">↩</button><button class="btn small" id="hc229ShiftClose" type="button" title="Cerrar jornada sin guardar" aria-label="Cerrar jornada">×</button>')
rep('let shiftRequired=false,shiftOpen=false,promptTimer=null,promptWaitCount=0;', 'let shiftRequired=false,shiftOpen=false,promptTimer=null,promptWaitCount=0,shiftDismissed=null;\n  function shiftDismissKey(){return userName()+"|"+dataInstitution()+"|"+localDate()+"|"+String(session?.globalToken||"");}')
rep('if(close)close.style.display=shiftRequired&&!ex?"none":"inline-flex";', 'if(close)close.style.display="inline-flex";')
rep('function closeShift(){if(shiftRequired&&!todayShift())return;shiftOpen=false;', 'function closeShift(){shiftDismissed=shiftDismissKey();clearTimeout(promptTimer);shiftOpen=false;')
rep('||shiftOpen||todayShift()){promptWaitCount=0;', '||shiftOpen||todayShift()||shiftDismissed===shiftDismissKey()){promptWaitCount=0;')
rep('if(ev.target.closest?.("#hc229ShiftClose")){closeShift();return;}', 'if(ev.target.closest?.("#hc299ShiftLogin")){closeShift();window.hc280PersistDrafts?.();const exit=document.getElementById("btnLogout");if(exit)exit.click();else if(typeof logout==="function")logout();document.getElementById("hc297Workspace")?.remove();document.getElementById("hc289Dialog")?.remove();hcInstitutionChooserClose?.();return;}if(ev.target.closest?.("#hc229ShiftClose")){closeShift();return;}')
rep('classList.contains("show")&&!shiftRequired)closeShift();', 'classList.contains("show"))closeShift();')
# Shared GPS validation also covers older patient and institution forms.
a=s.index('function geo(){return new Promise(');b=s.index('window.hc289Geo=geo;',a);s=s[:a]+"function geo(){return window.HC299Geo.locate();}\n"+s[b:]
a=s.index('function distance(i){if(!position');b=s.index('\n',a);s=s[:a]+"function distance(i){return window.HC299Geo.distance(position,i);}"+s[b:]
# Preserve GPS values in each professional availability block.
rep("+'<button type=\"button\" data-remove aria-label=\"Eliminar bloque\">Quitar</button>'", "+(mode==='office'?'<input data-latitude type=\"hidden\" value=\"'+E(w.latitude??'')+'\"><input data-longitude type=\"hidden\" value=\"'+E(w.longitude??'')+'\"><button type=\"button\" data-gps '+(f.elements.enabled.disabled?'disabled':'')+' data-located=\"'+String(window.HC299Geo.point(w)!==null)+'\" title=\"Ubicar este consultorio\" aria-label=\"Ubicación GPS del consultorio\">⌖</button>':'')+'<button type=\"button\" data-remove aria-label=\"Eliminar bloque\">Quitar</button>'")
rep("button[data-add],button[data-remove]", "button[data-add],button[data-remove],button[data-gps]")
rep("location:mode==='office'?$('[data-location]',r).value:''", "location:mode==='office'?$('[data-location]',r).value:'',latitude:mode==='office'?$('[data-latitude]',r).value:null,longitude:mode==='office'?$('[data-longitude]',r).value:null")
rep('profileProtocol:297','profileProtocol:299')
rep("'<p><b>Consultorio:</b> '+E(v.location_snapshot)+'</p>'", "'<p><b>Consultorio:</b> '+E(v.location_snapshot)+'</p><a class=\"hc299Map\" href=\"'+E(window.HC299Geo.mapURL({address:v.location_snapshot}))+'\" target=\"_blank\" rel=\"noopener noreferrer\">↗ Cómo llegar</a>'")
# Explicit GPS controls in the current patient search, never automatically prompting.
rep("let directory={providers:[],paymentsReady:false};", "let directory={providers:[],paymentsReady:false},patientPosition=null;")
rep('<p id="hc292Status" role="status">Cargando agendas…</p>', '<div class="hc299LocateBar"><button type="button" id="hc299Locate" title="Usar mi ubicación para buscar consultorios cercanos">⌖ Mi ubicación</button><button type="button" id="hc299ClearLocation" aria-label="Quitar ubicación de esta búsqueda" title="Quitar ubicación" hidden>×</button><span id="hc299LocationStatus" role="status">Ubicación opcional para ordenar consultorios por cercanía.</span></div><p id="hc292Status" role="status">Cargando agendas…</p>')
rep("else if(entry.available&&p)found.push(p);", "else if(entry.available&&p){p.available_locations=entry.locations||[];found.push(p);}")
rep(".sort((a,b)=>a.name.localeCompare(b.name,'es'));", ".sort((a,b)=>{if(patientPosition&&mode==='office'){const da=window.HC299Geo.nearest(patientPosition,a.available_locations),db=window.HC299Geo.nearest(patientPosition,b.available_locations);if(da!==db)return(da??Infinity)-(db??Infinity);}return a.name.localeCompare(b.name,'es');});")
rep("<small>'+E(p.specialty)+'</small></span>", "<small>'+E(p.specialty)+(patientPosition&&mode==='office'?' · '+(window.HC299Geo.nearest(patientPosition,p.available_locations)===null?'Sin punto GPS':'≈ '+window.HC299Geo.nearest(patientPosition,p.available_locations).toFixed(1)+' km'):'')+'</small></span>")
rep("q('#hc292MyVisits').onclick=()=>window.hc292Visits();specialties();", "q('#hc292MyVisits').onclick=()=>window.hc292Visits();q('#hc299Locate').onclick=e=>run(e.currentTarget,async()=>{q('#hc299LocationStatus').textContent='Buscando ubicación…';patientPosition=await window.HC299Geo.locate();if(!f.isConnected)return;q('#hc299LocationStatus').textContent='Ubicación obtenida'+(patientPosition.accuracy!==null?' · precisión aproximada ±'+Math.round(patientPosition.accuracy)+' m':'')+'. Se usa para ordenar Consultorio Privado por cercanía.';q('#hc299ClearLocation').hidden=false;render();},q('#hc299LocationStatus'));q('#hc299ClearLocation').onclick=()=>{patientPosition=null;q('#hc299LocationStatus').textContent='Ubicación quitada de esta búsqueda.';q('#hc299ClearLocation').hidden=true;render();};specialties();")
rep('<p id="hc292ReserveStatus" role="status"></p>', '<p id="hc292ReserveStatus" role="status"></p><a class="hc299Map" id="hc299Route" target="_blank" rel="noopener noreferrer" hidden>↗ Cómo llegar</a>')
rep("status.textContent=selected.address?'Ubicación elegida: '+selected.address:'';q('#hc292Slots')", "status.textContent=selected.address?'Ubicación elegida: '+selected.address:'';const route=q('#hc299Route'),url=window.HC299Geo.mapURL(selected);route.hidden=!url;if(url)route.href=url;q('#hc292Slots')")
css=Path('ui/gps.css').read_text();js=Path('ui/gps.js').read_text();a,b=s.rsplit('</body>',1);s=a+'<style id="hc-v299-gps-styles">'+css+'</style>\n<script id="hc-v299-gps">'+js+'</script>\n</body>'+b
Path('Hospitalito_v299.html').write_text(s)
