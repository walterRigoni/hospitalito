(() => {
  'use strict';
  const q = (root, selector) => root.querySelector(selector);
  const esc = value => window.hc289Esc(value);
  const portal = (...args) => window.hc289PortalApi(...args);
  const privateCare = (...args) => window.hc292Tele.api(...args);
  const argentina = 'America/Argentina/Buenos_Aires';
  const dateKey = new Intl.DateTimeFormat('fr-CA',{timeZone:argentina,year:'numeric',month:'2-digit',day:'2-digit'});
  const shifted = (day, amount) => new Date(Date.parse(day+'T12:00:00Z')+amount*86400000).toISOString().slice(0,10);
  const label = mode => mode==='institution'?'Instituciones':window.HC310.modeLabel(mode);
  const dayLabel = day => window.HC313.date(day);
  const timeLabel = local => window.HC313.time(local);
  const validDay = day => /^\d{4}-\d{2}-\d{2}$/.test(day||'');

  function canChange(booking) {
    const status = booking.privateVisit?['confirmed','awaiting_payment']:['confirmed','pending'];
    return status.includes(booking.status)&&Date.parse(booking.starts_at)>Date.now()&&
      (booking.status!=='awaiting_payment'||!booking.hold_until||Date.parse(booking.hold_until)>Date.now());
  }

  function manage(booking, operation) {
    const moving = operation==='move';
    const appointment = esc(window.HC313.dateTime(booking.starts_at,{timeZone:argentina}));
    const title = moving?'Reprogramar turno':'Cancelar turno';
    const pane = window.hc289Dialog(title,'<p>Turno actual · '+appointment+'</p>'+
      (moving?'<p>Elegí un nuevo horario con el mismo profesional.</p><label>Fecha nueva <input type="date" data-new-date required></label><div class="hc289Slots" data-new-slots></div>':
        '<p>El horario quedará disponible para otro paciente.'+(booking.privateVisit&&!booking.is_trial?' Si ya pagaste, se registrará una revisión del reintegro según las condiciones de tu reserva.':'')+'</p>')+
      '<div class="hc317Actions"><button type="button" data-appointment-confirm '+(moving?'disabled':'')+'>'+esc(moving?'Confirmar reprogramación':'Confirmar cancelación')+'</button>'+
      '<button type="button" class="hc314Ghost" data-back-appointments>Volver a Mis Turnos</button></div><p role="status"></p>');
    const back = () => window.hc305ShowAppointments();
    q(pane,'[data-289-close]').onclick = back;
    q(pane,'[data-back-appointments]').onclick = back;
    const confirm = q(pane,'[data-appointment-confirm]'), status = q(pane,'[role=status]');
    const date = q(pane,'[data-new-date]'), times = q(pane,'[data-new-slots]');
    let selection=null, revision=0, saving=false;

    async function load() {
      const attempt=++revision;
      selection=null;
      confirm.disabled=true;
      status.textContent='';
      times.replaceChildren();
      if(!date.checkValidity()||!validDay(date.value))return;
      const day=date.value;
      status.textContent='Consultando horarios…';
      try {
        const response = booking.privateVisit?
          await privateCare('rescheduleSlots',{visitId:booking.id,date:day}):
          await portal('calendar',{providerId:booking.provider_id,month:day.slice(0,7)});
        if(attempt!==revision||!pane.isConnected)return;
        const open = (booking.privateVisit?response.slots:response.days?.find(item=>item.date===day)?.slots)||[];
        const slots=open.filter(slot=>slot.available&&(slot.start?Date.parse(slot.start)!==Date.parse(booking.starts_at):true));
        status.textContent=slots.length?'':'No hay otros horarios disponibles ese día.';
        slots.forEach(slot=>{
          const button=document.createElement('button');
          button.type='button';
          button.textContent=[timeLabel(slot.local),slot.location,slot.address].filter(Boolean).join(' · ');
          button.setAttribute('aria-pressed','false');
          button.onclick=()=>{
            if(saving)return;
            times.querySelectorAll('button[aria-pressed=true]').forEach(item=>item.setAttribute('aria-pressed','false'));
            button.setAttribute('aria-pressed','true');
            selection=slot;
            confirm.disabled=false;
          };
          times.append(button);
        });
      } catch(error) {
        if(attempt===revision&&pane.isConnected)status.textContent=error.message;
      }
    }
    if(date){
      date.min=dateKey.format(new Date());
      date.max=shifted(date.min,booking.privateVisit?90:180);
      const sameDay=dateKey.format(new Date(booking.starts_at));
      date.value=sameDay>date.max?date.min:sameDay;
      date.onchange=load;
      load();
    }
    confirm.onclick=async()=>{
      if(saving||moving&&!selection)return;
      saving=true;
      confirm.disabled=true;
      if(date)date.disabled=true;
      status.textContent='Guardando…';
      const previousStart=booking.starts_at;
      const session=window.hc289ClientSession;
      try {
        const result=booking.privateVisit?
          await privateCare(moving?'reschedule':'cancel',{visitId:booking.id,previousStart,...(moving?{start:selection.start}:{})}):
          await portal(moving?'rescheduleBooking':'bookingStatus',{id:booking.id,previousStart,...(moving?{startLocal:selection.local}:{status:'cancelled'})});
        if(session!==window.hc289ClientSession)return;
        window.hc289Toast(moving?'Turno reprogramado.':result.refundPending?'Turno cancelado. Reintegro en revisión.':'Turno cancelado.');
        if(pane.isConnected)await back();
        else window.hc304RefreshPortal();
      } catch(error) {
        if(pane.isConnected)status.textContent=error.message;
      } finally {
        saving=false;
        confirm.disabled=false;
        if(date)date.disabled=false;
      }
    };
  }

  function waitlist(root) {
    root.innerHTML='<h3>Lista de espera</h3><p role="status">Cargando…</p><div data-entries></div>';
    const list=q(root,'[data-entries]'), status=q(root,'[role=status]');
    const refresh=async()=>{
      try {
        const response=await portal('myWaitlist');
        if(!root.isConnected)return;
        const entries=response.entries||[];
        status.textContent=entries.length?'':'Podés anotarte en Nuevo Turno cuando el día que elegiste esté completo.';
        list.innerHTML=entries.map((entry,index)=>'<article class="hc289Panel"><b>'+esc(entry.specialty||'Todas las especialidades')+'</b><p>'+
          esc(label(entry.mode)+' · '+(window.hc292Tele.roles[entry.role]||entry.role)+' · '+dayLabel(entry.from_day)+' al '+dayLabel(entry.until_day))+
          '</p><button type="button" data-leave="'+index+'">Salir de esta lista</button></article>').join('');
        list.querySelectorAll('[data-leave]').forEach(button=>button.onclick=async()=>{
          button.disabled=true;
          try {
            await portal('leaveWaitlist',{id:entries[Number(button.dataset.leave)].id});
            if(root.isConnected)await refresh();
          } catch(error) {
            status.textContent=error.message;
            button.disabled=false;
          }
        });
      } catch(error) { if(root.isConnected)status.textContent=error.message; }
    };
    refresh();
  }

  async function nextOffers({providers,institution,directory,mode,day,today,monthFor,privateSlots,isCurrent}) {
    const horizon=shifted(today,90);
    const verified=new Set((directory.verifications||[]).filter(v=>v.status==='verified').map(v=>v.institution_id));
    const eligible=institution?providers.filter(p=>!p.private_practice&&verified.has(p.institution_id)):
      providers.filter(p=>p.modes?.[mode]?.enabled&&p.modes[mode].rates?.length&&
        Object.values(p.modes[mode].weekly?.days||{}).some(day=>day?.active));
    const calendars=new Map();
    const monthCalendar=(provider,month)=>{
      const key=provider+':'+month;
      if(!calendars.has(key))calendars.set(key,monthFor(provider,month));
      return calendars.get(key);
    };
    let last=horizon;
    for(let first=shifted(day,1);eligible.length&&first<=horizon&&isCurrent();first=shifted(last,1)){
      last=[shifted(first,13),horizon].sort()[0];
      const found=await offerWindow({eligible,institution,mode,first,last,monthCalendar,privateSlots,isCurrent});
      if(found.offers.length||found.partial)return {...found,last};
    }
    return {offers:[],partial:false,last};
  }

  async function offerWindow({eligible,institution,mode,first,last,monthCalendar,privateSlots,isCurrent}) {
    const offers=[];
    let partial=false;
    if(institution){
      const months=[...new Set([first.slice(0,7),last.slice(0,7)])];
      for(let i=0;i<eligible.length&&isCurrent();i+=6){
        const found=await Promise.allSettled(eligible.slice(i,i+6).map(async profile=>{
          const calendars=await Promise.all(months.map(month=>monthCalendar(profile.id,month)));
          const slots=calendars.flatMap(j=>j.days||[]).filter(d=>d.date>=first&&d.date<=last)
            .flatMap(d=>d.slots||[]).filter(s=>s.available);
          return slots.slice(0,2).map(slot=>({profile,slot,day:slot.local.slice(0,10),minutes:null}));
        }));
        for(const item of found){
          if(item.status==='rejected')partial=true;
          else offers.push(...item.value);
        }
      }
    }else{
      for(let i=0;i<eligible.length&&isCurrent();i+=20){
        const group=eligible.slice(i,i+20);
        try {
          const response=await privateSlots(group,mode,first,last);
          for(const result of response.providers||[]){
            if(result.failed){partial=true;continue;}
            const profile=group.find(p=>p.username===result.id);
            if(profile)for(const slot of result.slots||[])
              offers.push({profile,slot,day:slot.local.slice(0,10),minutes:Math.min(...profile.modes[mode].rates.map(r=>r.minutes))});
          }
        } catch { partial=true; }
      }
    }
    return {offers,partial};
  }

  function offerList(root, offers, directory, mode, origin, select) {
    const ordered=offers.map(offer=>{
      const institution=directory.institutions?.find(item=>item.id===offer.profile.institution_id);
      const site=mode==='institution'?institution:offer.slot;
      return {...offer,site:{location:site?.location||institution?.name,address:site?.address||offer.profile.address,latitude:site?.latitude,longitude:site?.longitude}};
    });
    const distance=offer=>window.HC299Geo.distance(origin,offer.site);
    ordered.sort((a,b)=>a.slot.local.localeCompare(b.slot.local)||(distance(a)??Infinity)-(distance(b)??Infinity)||a.profile.name.localeCompare(b.profile.name,'es'));
    const shown=ordered.slice(0,8);
    root.innerHTML=shown.map((item,index)=>{
      const place=item.site.address||item.site.location?[item.site.location,item.site.address].filter(Boolean).join(' · '):'';
      const km=distance(item);
      const near=km===null?'':new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(km)+' km';
      return '<button type="button" class="hc310ProviderLine" data-next-offer="'+index+'"><b>'+esc(dayLabel(item.day)+' · '+timeLabel(item.slot.local))+
        '</b><span>'+esc(item.profile.name+(item.profile.specialty?' · '+item.profile.specialty:''))+'</span><small>'+esc([place,near].filter(Boolean).join(' · '))+'</small></button>';
    }).join('');
    root.querySelectorAll('[data-next-offer]').forEach(button=>button.onclick=()=>select(shown[Number(button.dataset.nextOffer)]));
  }

  window.HC317={canChange,manage,waitlist,nextOffers,offerList};
})();
