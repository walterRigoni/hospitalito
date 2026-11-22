"""Build v317 from the standalone v316 release."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / "Hospitalito_v316.html").read_text(encoding="utf-8")


def change(old, new):
    global page
    if page.count(old) != 1:
        raise ValueError(f"Expected one v316 match, found {page.count(old)}: {old[:140]}")
    page = page.replace(old, new)


for old in (
    "CURRENT_VERSION = 316;",
    "<title>Hospitalito v316",
    'window.HC_DEMO_VERSION="v316";document.title="Hospitalito · Historia Clínica Digital · v316";',
    '<span id="hc307Version">v316</span>',
    '>Hospitalito <small>v316</small>',
):
    change(old, old.replace("316", "317"))

change("""appointmentEmpty(loading))+'</div>';
 updatePortalNavigation();""", """appointmentEmpty(loading))+'</div><details class="hc289Panel" data-waitlist-panel><summary>Lista de espera</summary><div data-waitlist-entries></div></details>';
 const waitPanel=root.querySelector('[data-waitlist-panel]');
 waitPanel.ontoggle=()=>{if(waitPanel.open)window.HC317.waitlist(waitPanel.querySelector('[data-waitlist-entries]'));};
 updatePortalNavigation();""")

change("""(!privateVisit&&['pending','confirmed'].includes(b.status)?'<button type="button" data-289-cancel="'+E(b.id)+'">Cancelar turno</button>':'')""",
       """(window.HC317.canChange(b)?'<button type="button" data-appointment-action="move" data-appointment-id="'+E(b.id)+'">Reprogramar turno</button><button type="button" data-appointment-action="cancel" data-appointment-id="'+E(b.id)+'">Cancelar turno</button>':'')""")
change("""if(b.hasAttribute('data-hc305-turnos')){openMyAppointments();return;}""",
       """if(b.dataset.appointmentAction){const booking=allBookings().find(item=>String(item.id)===b.dataset.appointmentId);if(booking&&window.HC317.canChange(booking))window.HC317.manage(booking,b.dataset.appointmentAction);else window.hc289Toast('El turno cambió. Actualizá Mis Turnos.');return;}if(b.hasAttribute('data-hc305-turnos')){openMyAppointments();return;}""")

change("""'Recibí aquí un aviso 24 horas antes de tus turnos confirmados.':'Acá aparecen las nuevas solicitudes de turno.'""",
       """'Acá aparecen tus recordatorios, cambios de turnos y avisos de la lista de espera.':'Acá aparecen las solicitudes y los cambios de turno.'""")
change("""messages.map(n=>'<article class="hc289Panel"><b>'+E(n.title)+(n.read_at?'':' · Nuevo')+'</b><p>'+E(n.body)+'</p><button type="button" data-reminder-visit="'+E(n.payload?.visitId||'')+'" data-institution-visit="'+E(n.payload?.bookingId||'')+'" data-visit-mode="'+E(n.payload?.mode||'')+'">Ver turno</button></article>').join('')||'<p>No tenés recordatorios todavía.</p>';box.querySelectorAll('[data-reminder-visit]').forEach(b=>b.onclick=()=>{
  if(b.dataset.institutionVisit)""",
       """messages.map((n,i)=>{
  const payload=n.payload||{};
  const action=n.kind==='appointment_waitlist'
    ?'<button type="button" data-waitlist-offer="'+i+'">Consultar disponibilidad</button>'
    :payload.visitId||payload.bookingId&&window.hc289ClientSession
      ?'<button type="button" data-reminder-visit="'+E(payload.visitId||'')+'" data-institution-visit="'+E(payload.bookingId||'')+'" data-visit-mode="'+E(payload.mode||'')+'">Ver turno</button>':'';
  return '<article class="hc289Panel"><b>'+E(n.title)+(n.read_at?'':' · Nuevo')+'</b><p>'+E(n.body)+'</p>'+action+'</article>';
 }).join('')||'<p>No tenés avisos todavía.</p>';
 box.querySelectorAll('[data-waitlist-offer]').forEach(b=>b.onclick=()=>{
  const offer=messages[Number(b.dataset.waitlistOffer)]?.payload;
  if(!offer?.local||!window.hc289ClientSession)return;
  window.hc292Search({mode:offer.mode,day:offer.local.slice(0,10),role:offer.role,specialty:offer.specialty,providerId:offer.providerId,startLocal:offer.local,minutes:offer.minutes});
 });
 box.querySelectorAll('[data-reminder-visit]').forEach(b=>b.onclick=()=>{
  if(b.dataset.institutionVisit)""")
change("""(result.notifications||[]).filter(n=>n.kind==='tele_booking'&&!n.read_at)""",
       """(result.notifications||[]).filter(n=>['tele_booking','appointment_change'].includes(n.kind)&&!n.read_at)""")
change("""window.hc289Toast('Tenés una nueva solicitud de turno.');""", """window.hc289Toast('Tenés un nuevo aviso de turnos.');""")

change("""   getAvailability:(profiles,mode,date)=>api('availability',{providers:profiles.map(p=>p.username),mode,date}),""",
       """   getAvailability:(profiles,mode,date)=>api('availability',{providers:profiles.map(p=>p.username),mode,date}),
   nextPrivate:(profiles,mode,firstDay,lastDay)=>api('nextSlots',{providers:profiles.map(p=>p.username),mode,firstDay,lastDay}),
   joinWaitlist:filter=>window.hc289PortalApi('joinWaitlist',filter),""")
change("""   detail:(provider,mode,date)=>detail(provider,mode,date)""", """   detail:(provider,mode,date,preselected)=>detail(provider,mode,date,preselected)""")
change(""" async function detail(p,mode,date){""", """ async function detail(p,mode,date,preselected){""")
change("""const plan=q('#hc292Plan'),reserve=q('#hc292Reserve'),status=q('#hc292ReserveStatus');
 const closeProfile=""",
       """const plan=q('#hc292Plan'),reserve=q('#hc292Reserve'),status=q('#hc292ReserveStatus');
 if(preselected?.minutes&&m.rates.some(rate=>rate.minutes===preselected.minutes))plan.value=String(preselected.minutes);
 const closeProfile=""")
change("""can();});}catch(e){if(attempt===slotSerial&&plan.isConnected)q('#hc292Slots').textContent=e.message;}}""",
       """can();});
 if(preselected){
   const index=j.slots.findIndex(slot=>slot.available&&slot.local===preselected.local);
   if(index>=0)box.querySelector('[data-tele-slot="'+index+'"]')?.click();
   else status.textContent='Ese horario ya no está disponible. Podés elegir otro.';
   preselected=null;
 }
 }catch(e){if(attempt===slotSerial&&plan.isConnected)q('#hc292Slots').textContent=e.message;}}""")

change("""'<p id="hc292Status" role="status"></p><div id="hc292Directory"></div><div id="hc292Provider"></div></div></div>';""",
       """'<p id="hc292Status" role="status"></p><div id="hc292Directory"></div><section class="hc317Alternative" data-hc317-alternative hidden></section><div id="hc292Provider"></div></div></div>';""")
change("""    let localPosition=null, lastSearch=null;""", """    let localPosition=null, lastSearch=null, initialOffer=api.initial.providerId?api.initial:null;
    const alternatives=$('[data-hc317-alternative]',root);""")
change("""      status.textContent='';submit.disabled=false;updateLocationNote();""",
       """      status.textContent='';submit.disabled=false;updateLocationNote();alternatives.replaceChildren();alternatives.hidden=true;""")
change("""        if(mode==='office'&&lastSearch)renderResults(lastSearch);""",
       """        if(lastSearch){
          if(mode==='office')renderResults(lastSearch);
          if(lastSearch.offers)renderOffers(lastSearch);
        }""")
change("""    calendar($('#hc310BookingCalendar',root),{
      month:toDate(today),disabled:key=>key<today||toDate(key)-toDate(today)>90*86400000,
      onDay:key=>{reset();day=key;$('#hc310ChosenDate',root).textContent=dayLabel(key);form.hidden=false;form.elements.role.focus();}
    });""",
       r"""    const bookable=key=>/^\d{4}-\d{2}-\d{2}$/.test(key||'')&&key>=today&&toDate(key)-toDate(today)<=90*86400000;
    const chooseDay=key=>{reset();day=key;$('#hc310ChosenDate',root).textContent=dayLabel(key);form.hidden=false;form.elements.role.focus();};
    calendar($('#hc310BookingCalendar',root),{
      month:toDate(bookable(api.initial.day)?api.initial.day:today),selected:bookable(api.initial.day)?api.initial.day:'',
      disabled:key=>!bookable(key),onDay:key=>{initialOffer=null;chooseDay(key);}
    });
    if(api.initial.specialty)specialties([api.initial.specialty]);
    if(api.initial.specialty)form.elements.specialty.value=api.initial.specialty;
    if(bookable(api.initial.day))chooseDay(api.initial.day);""")
change("""        lastSearch={results,partial,institution,directory,selectedMode,selectedDay};
        renderResults(lastSearch);""",
       """        lastSearch={results,partial,institution,directory,selectedMode,selectedDay};
        renderResults(lastSearch);
        if(initialOffer){
          const offer=initialOffer;initialOffer=null;
          const record=results.find(item=>(institution?item.profile.id:item.profile.username)===offer.providerId);
          if(record){
            if(institution)institutionDetail(record,directory,details,selectedDay,api,offer.startLocal);
            else api.detail(record.profile,selectedMode,selectedDay,{local:offer.startLocal,minutes:offer.minutes});
          }else status.textContent='Ese horario ya no figura disponible. Podés consultar otras opciones.';
        }
        if(!results.length&&!partial){
          const search=lastSearch;
          alternatives.hidden=false;
          alternatives.innerHTML='<h3>Próximos turnos disponibles</h3><p data-next-status role="status">Consultando las próximas fechas…</p><div data-next-results></div>'+
            '<p>Si se libera un turno para esta búsqueda dentro de las próximas dos semanas, te avisamos en Avisos.</p>'+
            '<button type="button" data-join-waitlist>Anotarme en lista de espera</button><p data-wait-status role="status"></p>';
          const join=$('[data-join-waitlist]',alternatives),waitStatus=$('[data-wait-status]',alternatives);
          join.onclick=async()=>{
            join.disabled=true;
            try{
              await api.joinWaitlist({mode:selectedMode,role,specialty,date:selectedDay});
              if(join.isConnected)waitStatus.textContent='Quedaste en la lista. Podés salir desde Mis Turnos.';
            }catch(error){
              if(join.isConnected){waitStatus.textContent=error.message;join.disabled=false;}
            }
          };
          const next=await window.HC317.nextOffers({
            providers,institution,directory,mode:selectedMode,day:selectedDay,today,
            monthFor:api.getInstitutionSlots,privateSlots:api.nextPrivate,isCurrent:()=>alive(current)
          });
          if(alive(current)&&search===lastSearch){
            Object.assign(search,{offers:next.offers,nextPartial:next.partial,nextLast:next.last});
            renderOffers(search);
          }
        }""")
change("""    function renderResults({results,partial,institution,directory,selectedMode,selectedDay}) {""",
       """    if(initialOffer&&day)form.requestSubmit();

    function renderOffers({offers,nextPartial,nextLast,institution,directory,selectedMode,selectedDay}) {
      const status=$('[data-next-status]',alternatives);
      if(!status)return;
      status.textContent=nextPartial?'La búsqueda quedó incompleta. Podés volver a intentar.':
        nextLast<=selectedDay?'Llegaste al final del calendario de reservas.':
        offers.length?'Opciones hasta el '+dayLabel(nextLast)+'.':'No encontramos otros turnos hasta el '+dayLabel(nextLast)+'.';
      window.HC317.offerList($('[data-next-results]',alternatives),offers,directory,selectedMode,searchPosition(),offer=>{
        if(institution)institutionDetail({profile:offer.profile,slots:[offer.slot]},directory,details,offer.day,api,offer.slot.local);
        else api.detail(offer.profile,selectedMode,offer.day,{local:offer.slot.local,minutes:offer.minutes});
      });
    }

    function renderResults({results,partial,institution,directory,selectedMode,selectedDay}) {""")
change("""  function institutionDetail(record, directory, root, date, api) {""",
       """  function institutionDetail(record, directory, root, date, api, preferredLocal) {""")
change("""    reserve.onclick=async()=>{
      if(!selected||saving||!verified)return;""",
       """    if(preferredLocal){
      const index=slots.findIndex(slot=>slot.local===preferredLocal);
      if(index>=0)$('[data-slot-index="'+index+'"]',root)?.click();
      else if(verified)status.textContent='Ese horario ya no está disponible. Podés elegir otro.';
    }
    reserve.onclick=async()=>{
      if(!selected||saving||!verified)return;""")

style = (root / "ui/v317.css").read_text(encoding="utf-8")
script = (root / "ui/v317.js").read_text(encoding="utf-8")
change("</body>\n</html>", f'<style id="hc-v317-appointments">\n{style}</style>\n<script id="hc-v317-bookings">\n{script}</script>\n</body>\n</html>')
for filename in ("index.html", "Hospitalito_v317.html"):
    (root / filename).write_text(page, encoding="utf-8")
