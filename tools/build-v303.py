from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
s=Path('Hospitalito_v302.html').read_text()
def rep(a,b):
 global s
 assert a in s,a[:100]
 s=s.replace(a,b)
rep('Hospitalito v302','Hospitalito v303');rep("HC_DEMO_VERSION='v302'","HC_DEMO_VERSION='v303'");rep('HC Demo v302','HC Demo v303')
rep('<h2>Encontrá tu profesional</h2><p>','<h2>Encontrá tu profesional</h2><ol class="hc303Steps" aria-label="Pasos para reservar"><li data-booking-step="1" aria-current="step">Atención</li><li data-booking-step="2">Profesional</li><li data-booking-step="3">Horario y reserva</li></ol><p>')
rep("const f=q('#hc292SearchForm');f.elements.role.value=", "const f=q('#hc292SearchForm');function updateSteps(step){root.querySelectorAll('[data-booking-step]').forEach(el=>{if(Number(el.dataset.bookingStep)===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});}f.elements.role.value=")
rep("const render=async()=>{const version=++renderVersion;q('#hc292Provider').innerHTML='';", "const render=async()=>{const version=++renderVersion;updateSteps(1);q('#hc292Provider').innerHTML='';")
rep("q('#hc292Directory').querySelectorAll('[data-tele-profile]').forEach", "updateSteps(providers.length?2:1);q('#hc292Directory').querySelectorAll('[data-tele-profile]').forEach")
rep("async function detail(p,mode,date){const box=", "async function detail(p,mode,date){updateSteps(3);const box=")
rep("const closeProfile=()=>{slotSerial++;selected=null;box.replaceChildren();", "const closeProfile=()=>{slotSerial++;selected=null;updateSteps(2);box.replaceChildren();")
rep("summary.textContent='Datos profesionales · '","summary.textContent='1 · Perfil profesional · '")
rep('<b>Días y horarios</b><small>Verde = disponible</small>','<b>2 · Días y horarios</b><small>Verde = disponible</small>')
rep("q('legend',rates).textContent='Tarifas · ARS';", "q('legend',rates).textContent='3 · Tarifas · ARS';")
a,b=s.rsplit('</body>',1);s=a+'<style id="hc-v303-compact-portal">'+Path('ui/compact-portal.css').read_text()+'</style>\n</body>'+b
Path('Hospitalito_v303.html').write_text(s)
