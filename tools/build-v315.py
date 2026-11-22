"""Build v315 from the standalone v314 release."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
page = (root / "Hospitalito_v314.html").read_text(encoding="utf-8")


def change(old, new):
    global page
    count = page.count(old)
    if count != 1:
        raise ValueError(f"Expected one v314 match, found {count}: {old[:140]}")
    page = page.replace(old, new)


for old, new in [
    ("CURRENT_VERSION = 314;", "CURRENT_VERSION = 315;"),
    ("<title>Hospitalito v314", "<title>Hospitalito v315"),
    ('window.HC_DEMO_VERSION="v314";document.title="Hospitalito · Historia Clínica Digital · v314";',
     'window.HC_DEMO_VERSION="v315";document.title="Hospitalito · Historia Clínica Digital · v315";'),
    ('<span id="hc307Version">v314</span>', '<span id="hc307Version">v315</span>'),
    ('>Hospitalito <small>v314</small>', '>Hospitalito <small>v315</small>'),
]:
    change(old, new)

change("""main().innerHTML='<button data-289-back>‹ Calendario</button><h2>'+E(window.HC313.dayLabel(key))+'</h2>'+rows.map(bookingRow).join('')+(!rows.length?'<p>No tenés turnos para este día.</p>':'')+'<button data-289-new>Nuevo turno</button>';""",
       """main().innerHTML=window.HC314.sectionHeader(window.HC313.dayLabel(key))+rows.map(bookingRow).join('')+(!rows.length?'<p>No tenés turnos para este día.</p>':'');""")
change("   initial, roles, options, money, dateKey, alive:()=>seq===searchSerial,",
       """   initial, roles, options, money, dateKey, alive:()=>seq===searchSerial,
   patientPosition:()=>window.hc315PatientPosition?.(),""")
change("window.hc310ReleaseBooking=()=>{bookingUI=null;};",
       """window.hc310ReleaseBooking=()=>{bookingUI=null;};
window.hc315PatientPosition=()=>window.HC299Geo.point(me?.client?.profile);""")
change("""    main.innerHTML='<div class="hc310Booking">'+
      '<label class="hc310Urgency">""",
       """    main.innerHTML=window.HC314.sectionHeader('Nuevo Turno')+'<div class="hc310Booking">'+
      '<label class="hc310Urgency">""")
change("""      '<div data-booking-controls><button type="button" data-hc310-close>‹ Calendario</button><h2>Nuevo Turno</h2>'+""",
       """      '<div data-booking-controls>'+""")
change("""      '<div id="hc310BookingCalendar"></div><p id="hc310ChosenDate" """,
       """      '<div class="hc315Location" hidden><button type="button" class="hc314Ghost" data-search-location>Usar mi ubicación actual</button>'+
      '<p data-location-note></p><p data-location-status role="status"></p></div>'+
      '<div id="hc310BookingCalendar"></div><p id="hc310ChosenDate" """)
change("    $('[data-hc310-close]',root).onclick=portalActions.home;\n", "")
change("""    const status=$('#hc292Status',root), submit=$('[type=submit]',form);""",
       """    const status=$('#hc292Status',root), submit=$('[type=submit]',form);
    const locationBox=$('.hc315Location',root), locateButton=$('[data-search-location]',root);
    const locationNote=$('[data-location-note]',root), locationStatus=$('[data-location-status]',root);
    let localPosition=null, lastSearch=null;
    const searchPosition=()=>localPosition||api.patientPosition?.();""")
change("    function reset() {revision++;list.replaceChildren();details.replaceChildren();status.textContent='';submit.disabled=false;}",
       """    function reset() {
      revision++;lastSearch=null;list.replaceChildren();details.replaceChildren();
      status.textContent='';submit.disabled=false;updateLocationNote();
    }
    function updateLocationNote() {
      locationNote.textContent=localPosition?'Distancias en línea recta desde tu ubicación actual.'
        :searchPosition()?'Distancias en línea recta desde la ubicación guardada en tu perfil.'
        :'La lista se ordena por nombre hasta que compartas tu ubicación.';
    }
    locateButton.onclick=async()=>{
      locateButton.disabled=true;locationStatus.textContent='Buscando tu ubicación…';
      try{
        const point=await window.HC299Geo.locate();
        if(!root.isConnected)return;
        localPosition=point;
        locationStatus.textContent='';
        updateLocationNote();
        if(mode==='office'&&lastSearch)renderResults(lastSearch);
      }catch{
        if(root.isConnected)locationStatus.textContent='No pudimos obtener tu ubicación actual. Revisá los permisos de ubicación y volvé a intentar.';
      }finally{locateButton.disabled=false;}
    };""")
change("""      root.querySelectorAll('[data-care-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.careMode===mode)));""",
       """      root.querySelectorAll('[data-care-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.careMode===mode)));
      locationBox.hidden=mode!=='office';
      if(!locationBox.hidden)updateLocationNote();""")
change("""                if(profile&&provider.available)results.push({profile});""",
       """                if(profile&&provider.available)results.push({profile,locations:provider.locations});""")
change("""        results.sort((a,b)=>a.profile.name.localeCompare(b.profile.name,'es'));
        status.textContent=partial?'La búsqueda quedó incompleta. Podés presionar Buscar para reintentar.':results.length?'Profesionales disponibles':'Sin horarios publicados para ese día.';
        list.innerHTML=results.map(({profile:p},i)=>{
          const rate = institution?'Turnos institucionales':p.trialAvailable?'Prueba gratuita':'Desde '+api.money(Math.min(...p.modes[selectedMode].rates.map(r=>r.amount_cents)));
          return '<button class="hc310ProviderLine" type="button" data-result="'+i+'"><b>'+E(p.name)+'</b><small>'+E(p.specialty)+' · '+E(rate)+'</small></button>';
        }).join('');
        list.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{
          const record=results[Number(b.dataset.result)];
          if(institution)institutionDetail(record,directory,details,selectedDay,api);
          else api.detail(record.profile,selectedMode,selectedDay);
        });""",
       """        lastSearch={results,partial,institution,directory,selectedMode,selectedDay};
        renderResults(lastSearch);""")
change("""    };
  }

  function institutionDetail(record, directory, root, date, api) {""",
       """    };

    function renderResults({results,partial,institution,directory,selectedMode,selectedDay}) {
      const origin=selectedMode==='office'?searchPosition():null;
      const ordered=window.HC315.rankProviders(results,origin);
      const ranked=ordered.some(item=>item.closest);
      if(selectedMode==='office')updateLocationNote();
      status.textContent=partial?'La búsqueda quedó incompleta. Podés presionar Buscar para reintentar.'
        :ordered.length?'Profesionales disponibles'+(ranked?' · por cercanía':''):'Sin horarios publicados para ese día.';
      list.innerHTML=ordered.map(({profile:p,closest},i)=>{
        const rate=institution?'Turnos institucionales':p.trialAvailable?'Prueba gratuita':'Desde '+api.money(Math.min(...p.modes[selectedMode].rates.map(r=>r.amount_cents)));
        const distance=origin?'<small>'+E(window.HC315.distanceLabel(closest))+'</small>':'';
        return '<button class="hc310ProviderLine" type="button" data-result="'+i+'"><b>'+E(p.name)+'</b><small>'+E(p.specialty)+' · '+E(rate)+'</small>'+distance+'</button>';
      }).join('');
      list.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{
        const record=ordered[Number(b.dataset.result)];
        if(institution)institutionDetail(record,directory,details,selectedDay,api);
        else api.detail(record.profile,selectedMode,selectedDay);
      });
    }
  }

  function institutionDetail(record, directory, root, date, api) {""")

script = (root / "ui/v315.js").read_text(encoding="utf-8")
style = (root / "ui/v315.css").read_text(encoding="utf-8")
change("</body>\n</html>",f'<style id="hc-v315-styles">\n{style}</style>\n<script id="hc-v315-booking">\n{script}</script>\n</body>\n</html>')
for filename in ("index.html","Hospitalito_v315.html"):
    (root / filename).write_text(page,encoding="utf-8")
