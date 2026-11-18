from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])
s=Path('Hospitalito_v299.html').read_text()
def rep(a,b):
 global s
 assert a in s,a[:120]
 s=s.replace(a,b)
rep('Hospitalito v299','Hospitalito v300');rep("HC_DEMO_VERSION='v299'","HC_DEMO_VERSION='v300'");rep('HC Demo v299','HC Demo v300')
rep('close.style.display=options.required?"none":"inline-flex";', 'close.style.display="inline-flex";')
# The detail is inline: close returns to the existing filtered list, without reloading it.
rep("box.innerHTML='<section class=\"hc289Panel\">'+portrait(p)", "box.innerHTML='<section class=\"hc289Panel\"><nav class=\"hc300ProfileNav\" aria-label=\"Navegación de la ficha\"><button type=\"button\" data-hc300-back-profile title=\"Volver al listado\" aria-label=\"Volver al listado de profesionales\">↩</button><button type=\"button\" data-hc300-close-profile title=\"Cerrar ficha\" aria-label=\"Cerrar ficha del profesional\">×</button></nav>'+portrait(p)")
needle="status=q('#hc292ReserveStatus');\n const can=()"
rep(needle,"status=q('#hc292ReserveStatus');\n const closeProfile=()=>{slotSerial++;selected=null;box.replaceChildren();const trigger=[...q('#hc292Directory').querySelectorAll('[data-tele-profile]')].find(b=>b.dataset.teleProfile===p.username);trigger?.focus({preventScroll:true});q('#hc292Directory').scrollIntoView({block:'nearest'});};box.querySelector('[data-hc300-back-profile]').onclick=closeProfile;box.querySelector('[data-hc300-close-profile]').onclick=closeProfile;\n const can=()")
rep("await window.hc292Visit(j.visit.id);},status);", "if(plan.isConnected)await window.hc292Visit(j.visit.id);else window.hc289Toast('Reserva confirmada. Podés verla en Mis consultas.');},status);")
css=Path('ui/navigation.css').read_text();js=Path('ui/navigation.js').read_text();a,b=s.rsplit('</body>',1);s=a+'<style id="hc-v300-navigation-styles">'+css+'</style>\n<script id="hc-v300-navigation">'+js+'</script>\n</body>'+b
Path('Hospitalito_v300.html').write_text(s)
