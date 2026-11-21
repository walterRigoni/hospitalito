(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const E = window.hc289Esc;
  const modes = {
    telemedicine: 'Telemedicina', office: 'Consultorio Privado',
    home: 'Atención a Domicilio', institution: 'Instituciones'
  };
  const modeLabel = mode => modes[mode] || modes.institution;
  const pad = number => String(number).padStart(2, '0');
  const keyOf = date => date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  const toDate = key => new Date(key + 'T12:00:00');
  const argentina = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const dayLabel = key => toDate(key).toLocaleDateString('es-AR', {dateStyle:'full'});
  const time = date => new Date(date).toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', hour:'2-digit', minute:'2-digit', hour12:false
  });
  const past = new Set(['cancelled', 'finished', 'attended', 'expired']);
  function touch(event) {
    return event.pointerType === 'touch' || event.pointerType === 'pen' || matchMedia('(hover:none)').matches;
  }
  function avatar(button, user) {
    if (!button) return;
    const photo = user?.photo || user?.profile?.photo || '';
    const src = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) ? photo : '';
    const key = src || 'default';
    if (button.hc310Avatar === key) return;
    button.hc310Avatar = key;
    button.classList.add('hc310Avatar');
    button.setAttribute('aria-label','Perfil');
    button.title = 'Perfil';
    button.innerHTML = src ? '<img alt="" src="'+src+'">' : window.hc289Icon('user');
  }
  function portalMarkup(user) {
    return '<header><button type="button" data-hc310-home aria-label="Volver al calendario">Hospitalito <small>v310</small></button>'+
      '<span class="hc289PortalWho">'+E(user.name)+'</span><button id="hc289PortalAccount" type="button" aria-haspopup="menu">Perfil</button></header>'+
      '<div class="hc289PortalLayout hc310Layout"><aside id="hc289Registry" class="hc289Registry">'+
      '<h2>Mis Turnos</h2><nav class="hc310SideNav" aria-label="Portal del paciente">'+
      '<button type="button" data-hc310-studies>Mis Estudios</button><button type="button" data-hc310-reminders>Avisos</button></nav>'+
      '<div class="hc289RegistryScroll" id="hc289RegistryContent" aria-live="polite"></div>'+
      '<div class="hc310SideFooter"><button type="button" data-hc310-book>＋ Nuevo Turno</button></div></aside>'+
      '<div class="hc310Divider" role="separator" aria-label="Ancho de Mis Turnos" aria-orientation="vertical" tabindex="0"></div>'+
      '<button type="button" class="hc310SideToggle" aria-controls="hc289Registry">‹</button>'+
      '<main id="hc289PortalMain" class="hc289PortalMain"></main></div>';
  }
  let portalActions;
  function sidebar(portal, actions) {
    portalActions = actions;
    const layout = $('.hc310Layout',portal), divider = $('.hc310Divider',portal), toggle = $('.hc310SideToggle',portal);
    const mobile = matchMedia('(max-width:760px)');
    let activeDrag = null;
    function width(value) {
      const actual = Math.max(205,Math.min(value,Math.min(560,layout.clientWidth-320)));
      layout.style.setProperty('--sidebar-size', actual+'px');
      divider.setAttribute('aria-valuenow',String(Math.round(actual)));
    }
    function setOpen(open) {
      layout.classList.toggle('hc310Closed',!open);
      $('#hc289Registry',layout).inert = !open;
      toggle.textContent = open?'‹':'›';
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'Ocultar Mis Turnos':'Mostrar Mis Turnos');
    }
    function choose(action) {
      if (mobile.matches) setOpen(false);
      action();
    }
    divider.onpointerdown = event => {
      if (event.button !== 0 || mobile.matches) return;
      activeDrag = {id:event.pointerId,x:event.clientX,width:$('#hc289Registry',layout).offsetWidth};
      divider.setPointerCapture(event.pointerId);
      layout.classList.add('hc310Resizing');
      event.preventDefault();
    };
    divider.onpointermove = event => {
      if (activeDrag?.id === event.pointerId) width(activeDrag.width+event.clientX-activeDrag.x);
    };
    divider.onlostpointercapture = () => {activeDrag=null;layout.classList.remove('hc310Resizing');};
    divider.onkeydown = event => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      width($('#hc289Registry',layout).offsetWidth+(event.key==='ArrowRight'?16:-16));
    };
    toggle.onclick = () => setOpen(layout.classList.contains('hc310Closed'));
    $('[data-hc310-home]',portal).onclick = () => choose(actions.home);
    $('[data-hc310-book]',portal).onclick = () => choose(actions.book);
    $('[data-hc310-studies]',portal).onclick = () => choose(actions.studies);
    $('[data-hc310-reminders]',portal).onclick = () => choose(actions.reminders);
    $('#hc289RegistryContent',portal).addEventListener('click',event=>{
      if (mobile.matches&&event.target.closest('[data-hc310-visit]')) setOpen(false);
    });
    setOpen(!mobile.matches);
    if (!mobile.matches) width(290);
    avatar($('#hc289PortalAccount',portal),window.hc289ClientSession?.user);
  }

  function renderSidebar(bookings,directory,ready,warning,ui) {
    const box = $('#hc289RegistryContent');
    if (!box) return;
    const provider = b => b.peer_name || b.provider_name || directory.providers?.find(p=>p.id===b.provider_id)?.name || 'Profesional';
    const rows = (group, label) => '<h3>'+label+'</h3>' + (!group.length?'<p class="hc310Muted">'+
      (ready?'Sin turnos':warning?'Datos sin actualizar':'Cargando…')+'</p>':group.map(b=>
      '<button type="button" data-hc310-visit="'+E(b.id)+'" class="hc310VisitLine"><i data-state="'+ui.color(b)+'"></i>'+
      '<span><b>'+E(provider(b))+'</b><small>'+E(ui.format(b.starts_at))+' · '+E(modeLabel(b.mode))+'</small>'+
      '<small>'+E(ui.status(b.status))+'</small></span></button>').join(''));
    const next = bookings.filter(b=>['future','pending'].includes(ui.color(b)));
    const older = bookings.filter(b=>!next.includes(b)).reverse();
    const html = rows(next,'Próximos Turnos')+rows(older,'Turnos Anteriores')+(warning?
      '<p class="hc310Muted">'+E(warning)+'</p><button type="button" data-hc310-retry>Actualizar</button>':'');
    if(box.hc310LastHTML!==html){
      box.innerHTML=html;box.hc310LastHTML=html;
    }
    box.querySelectorAll('[data-hc310-visit]').forEach(button=>button.onclick=()=>{
      const b=bookings.find(item=>String(item.id)===button.dataset.hc310Visit);
      if(b)ui.detail(b);
    });
    if ($('[data-hc310-retry]',box)) $('[data-hc310-retry]',box).onclick=portalActions.refresh;
  }

  function calendar(host, options) {
    let month = new Date(options.month.getFullYear(),options.month.getMonth(),1);
    host.innerHTML = '<section class="hc310Calendar'+(options.tall?' hc310CalendarTall':'')+'"><div class="hc310MonthHeader">'+
      '<button type="button" data-prev aria-label="Mes anterior">‹</button><h2></h2><button type="button" data-next aria-label="Mes siguiente">›</button></div>'+
      '<div class="hc310CalendarViewport" aria-label="Calendario" tabindex="0"><div class="hc310CalendarTrack"></div></div>'+
      (options.warning?'<p role="status" class="hc310Muted">'+E(options.warning)+'</p>':'')+'</section>';
    const view=$('.hc310CalendarViewport',host), track=$('.hc310CalendarTrack',host);
    let drag=null, blockClick=0, generation=0;
    const offset=(date, delta)=>new Date(date.getFullYear(),date.getMonth()+delta,1);
    function grid(date,inactive) {
      const start = (date.getDay()+6)%7;
      const days = Array.from({length:42},(_,index)=>{
        const d = new Date(date.getFullYear(),date.getMonth(),index-start+1);
        const key = keyOf(d), mainMonth = d.getMonth()===date.getMonth();
        const events = options.getEvents?.(key)||[];
        const state = events.includes('future')?'future':events.includes('pending')?'pending':events[0]||'';
        const disabled = inactive||!mainMonth||options.disabled?.(key);
        return '<button type="button" data-day-key="'+key+'" data-state="'+E(state)+'" '+
          (disabled?'disabled ':'')+(key===options.selected?'aria-pressed="true" ':'aria-pressed="false" ')+
          'aria-label="'+E(dayLabel(key)+(events.length?' · '+events.length+' turnos':''))+'"><span>'+d.getDate()+'</span>'+
          (events.length?'<small>'+events.length+(events.length===1?' turno':' turnos')+'</small>':'')+'</button>';
      });
      return '<div class="hc310MonthGrid"'+(inactive?' aria-hidden="true" inert':'')+'>'+
        ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(day=>'<span>'+day+'</span>').join('')+days.join('')+'</div>';
    }
    function render() {
      $('.hc310MonthHeader h2',host).textContent=month.toLocaleDateString('es-AR',{month:'long',year:'numeric'});
      track.style.transition='none';track.style.transform='translateX(-33.333333%)';
      track.innerHTML=grid(offset(month,-1),true)+grid(month,false)+grid(offset(month,1),true);
    }
    function move(direction,animate) {
      const sequence=++generation;
      const finish=()=>{
        if(sequence!==generation||!track.isConnected)return;
        if(direction){month=offset(month,direction);options.onMonth?.(month);}
        render();
      };
      if(!animate||matchMedia('(prefers-reduced-motion:reduce)').matches){finish();return;}
      track.style.transition='transform 160ms ease-out';
      track.style.transform='translateX('+(-100*(1+direction)/3)+'%)';
      setTimeout(finish,170);
    }
    view.onpointerdown=event=>{
      if(event.button!==0)return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,active:false};
    };
    view.onpointermove=event=>{
      if(drag?.id!==event.pointerId)return;
      const dx=event.clientX-drag.x;
      if(!drag.active){
        if(Math.abs(dx)<8||Math.abs(dx)<Math.abs(event.clientY-drag.y))return;
        drag.active=true;++generation;view.setPointerCapture(event.pointerId);
      }
      const ratio=Math.max(-1,Math.min(1,dx/view.clientWidth));
      track.style.transition='none';track.style.transform='translateX('+((-1+ratio)*100/3)+'%)';
    };
    view.onpointerup=event=>{
      if(drag?.id!==event.pointerId)return;
      if(drag.active){
        const dx=event.clientX-drag.x;blockClick=Date.now()+250;
        move(Math.abs(dx)>45?(dx<0?1:-1):0,true);
      }
      drag=null;
    };
    view.onpointercancel=()=>{if(drag?.active)move(0,true);drag=null;};
    view.onclick=event=>{
      const button=event.target.closest('[data-day-key]');
      if(!button||button.disabled||Date.now()<blockClick)return;
      options.selected=button.dataset.dayKey;
      track.querySelectorAll('[data-day-key][aria-pressed=true]').forEach(item=>item.setAttribute('aria-pressed','false'));
      button.setAttribute('aria-pressed','true');
      options.onDay(button.dataset.dayKey);
    };
    view.onkeydown=event=>{
      if(event.target!==view||!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();move(event.key==='ArrowLeft'?-1:1,true);
    };
    $('[data-prev]',host).onclick=()=>move(-1,true);
    $('[data-next]',host).onclick=()=>move(1,true);
    render();
    return {render};
  }

  function settingsMarkup(theme) {
    return '<div class="hcSettingsShell hc310Settings"><nav class="hcSettingsNav" aria-label="Configuración"><button type="button" data-client-settings="account">Perfil</button><button type="button" class="active" aria-current="page">Apariencia</button><button type="button" data-client-settings="privacy">Seguridad</button></nav>'+
      '<div class="hcSettingsStage">'+theme+'</div></div>';
  }
  function bindSettings(el, open) {
    el.querySelectorAll('[data-client-settings]').forEach(b=>b.onclick=()=>open(b.dataset.clientSettings));
  }
  function closePanel(el) {
    if(el.classList.contains('hc310Inline'))portalActions?.home();
    else el.remove();
  }

  async function booking(main, api) {
    const today=api.dateKey();
    let day='', mode=Object.hasOwn(modes,api.initial.mode)?api.initial.mode:'telemedicine', revision=0;
    main.innerHTML='<div class="hc310Booking"><button type="button" data-hc310-close>‹ Calendario</button><h2>Nuevo Turno</h2>'+
      '<div class="hc309CareChoices" role="group" aria-label="Modalidad">'+Object.entries(modes).map(([key,label])=>
        '<button type="button" data-care-mode="'+key+'"><b>'+E(label)+'</b></button>').join('')+'</div>'+
      '<label class="hc310Urgency"><input type="checkbox" id="hc289Urgent"> URGENCIA</label>'+
      '<aside id="hc310UrgentHelp" hidden><p>Si necesitás atención inmediata, llamá a emergencias. Los turnos de este portal son programados.</p><a href="tel:107">Llamar al 107</a></aside>'+
      '<div id="hc310BookingCalendar"></div><p id="hc310ChosenDate" class="hc310Muted">Elegí el día del turno.</p>'+
      '<form id="hc292SearchForm" class="hc289Form" hidden><label>Profesional<select name="role">'+
      Object.entries(api.roles).map(([role,label])=>'<option value="'+role+'">'+E(label)+'</option>').join('')+'</select></label>'+
      '<label>Especialidad<select name="specialty"></select></label><button type="submit" class="hc289Primary">Buscar</button></form>'+
      '<p id="hc292Status" role="status"></p><div id="hc292Directory"></div><div id="hc292Provider"></div></div>';
    const root=$('.hc310Booking',main), form=$('form',root), list=$('#hc292Directory',root), details=$('#hc292Provider',root);
    const status=$('#hc292Status',root), submit=$('[type=submit]',form);
    const alive=number=>root.isConnected&&api.alive()&&number===revision;
    form.elements.role.value=api.initial.role||'medico';
    function specialties(extra=[]) {
      const old=form.elements.specialty.value;
      form.elements.specialty.innerHTML='<option value="">Todas</option>'+api.options(form.elements.role.value,extra);
      if([...form.elements.specialty.options].some(o=>o.value===old))form.elements.specialty.value=old;
    }
    function reset() {revision++;list.replaceChildren();details.replaceChildren();status.textContent='';submit.disabled=false;}
    function chooseMode() {
      root.querySelectorAll('[data-care-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.careMode===mode)));
    }
    root.querySelectorAll('[data-care-mode]').forEach(b=>b.onclick=()=>{if(mode!==b.dataset.careMode){mode=b.dataset.careMode;reset();chooseMode();}});
    $('[data-hc310-close]',root).onclick=portalActions.home;
    $('#hc289Urgent',root).onchange=event=>{$('#hc310UrgentHelp',root).hidden=!event.target.checked;};
    specialties();chooseMode();
    form.elements.role.onchange=()=>{specialties();reset();};
    form.elements.specialty.onchange=reset;
    calendar($('#hc310BookingCalendar',root),{
      month:toDate(today),disabled:key=>key<today||toDate(key)-toDate(today)>90*86400000,
      onDay:key=>{reset();day=key;$('#hc310ChosenDate',root).textContent=dayLabel(key);form.hidden=false;form.elements.role.focus();}
    });
    form.onsubmit=async event=>{
      event.preventDefault();if(!day||submit.disabled)return;
      reset();const current=revision, selectedMode=mode, selectedDay=day;
      const role=form.elements.role.value,specialty=form.elements.specialty.value;
      const institution=selectedMode==='institution';
      submit.disabled=true;status.textContent='Buscando profesionales disponibles…';
      let partial=false;
      try{
        const directory=await (institution?api.institutionDirectory():api.privateDirectory());
        if(!alive(current))return;
        const providers=(directory.providers||[]).filter(p=>p.role===role&&(!specialty||p.specialty===specialty));
        specialties((directory.providers||[]).filter(p=>p.role===role).map(p=>p.specialty));
        const results=[];
        if(institution){
          const eligible=providers.filter(p=>!p.private_practice);
          for(let i=0;i<eligible.length&&alive(current);i+=6){
            const found=await Promise.allSettled(eligible.slice(i,i+6).map(async p=>{
              const result=await api.getInstitutionSlots(p.id,selectedDay.slice(0,7));
              const slots=(result.days||[]).find(d=>d.date===selectedDay)?.slots?.filter(s=>s.available)||[];
              return slots.length?{profile:p,slots}:null;
            }));
            for(const item of found){
              if(item.status==='rejected')partial=true;
              else if(item.value)results.push(item.value);
            }
          }
        }else{
          const eligible=providers.filter(p=>{
            const info=p.modes?.[selectedMode];
            return info?.enabled&&info.rates?.length&&info.weekly?.days?.[toDate(selectedDay).getDay()]?.active;
          });
          for(let i=0;i<eligible.length&&alive(current);i+=50){
            const group=eligible.slice(i,i+50);
            try{
              const response=await api.getAvailability(group,selectedMode,selectedDay);
              for(const provider of response.providers||[]){
                if(provider.failed){partial=true;continue;}
                const profile=group.find(p=>p.username===provider.id);
                if(profile&&provider.available)results.push({profile});
              }
            }catch{partial=true;}
          }
        }
        if(!alive(current))return;
        results.sort((a,b)=>a.profile.name.localeCompare(b.profile.name,'es'));
        status.textContent=partial?'La búsqueda quedó incompleta. Podés presionar Buscar para reintentar.':results.length?'Profesionales disponibles':'Sin horarios publicados para ese día.';
        list.innerHTML=results.map(({profile:p},i)=>{
          const rate = institution?'Turnos institucionales':p.trialAvailable?'Prueba gratuita':'Desde '+api.money(Math.min(...p.modes[selectedMode].rates.map(r=>r.amount_cents)));
          return '<button class="hc310ProviderLine" type="button" data-result="'+i+'"><b>'+E(p.name)+'</b><small>'+E(p.specialty)+' · '+E(rate)+'</small></button>';
        }).join('');
        list.querySelectorAll('[data-result]').forEach(b=>b.onclick=()=>{
          const record=results[Number(b.dataset.result)];
          if(institution)institutionDetail(record,directory,details,selectedDay,api);
          else api.detail(record.profile,selectedMode,selectedDay);
        });
      }catch(error){if(alive(current))status.textContent=error.message+' Podés volver a buscar.';}
      finally{if(alive(current))submit.disabled=false;}
    };
  }

  function institutionDetail(record, directory, root, date, api) {
    const {profile, slots}=record, institution=directory.institutions?.find(i=>i.id===profile.institution_id);
    root.innerHTML='<section class="hc310ResultDetail"><button type="button" data-close-detail>Cerrar ficha</button><h3>'+E(profile.name)+'</h3><p>'+
      E(profile.specialty)+' · '+E(institution?.name||'Institución')+'</p><h4>'+E(dayLabel(date))+
      '</h4><div class="hc289Slots">'+slots.map((slot,i)=>'<button type="button" data-slot-index="'+i+'" aria-pressed="false">'+E(slot.local.slice(-5))+'</button>').join('')+
      '</div><label>Motivo de consulta <input maxlength="1000"></label><button type="button" data-reserve disabled>Solicitar turno</button><p role="status"></p></section>';
    const reserve=$('[data-reserve]',root), status=$('[role=status]',root);
    let selected=null,saving=false;
    const verified=directory.verifications?.some(verification=>verification.institution_id===profile.institution_id&&verification.status==='verified');
    if(!verified){
      status.textContent='La institución debe verificar tu identidad antes de que puedas reservar.';
      const request=document.createElement('button');request.type='button';request.textContent='Solicitar verificación';
      status.after(request);
      request.onclick=async()=>{
        request.disabled=true;
        try{await api.verifyInstitution(profile.institution_id);status.textContent='Solicitud enviada a la institución.';}
        catch(error){status.textContent=error.message;request.disabled=false;}
      };
    }
    $('[data-close-detail]',root).onclick=()=>root.replaceChildren();
    root.querySelectorAll('[data-slot-index]').forEach(button=>button.onclick=()=>{
      if(saving)return;
      selected=slots[Number(button.dataset.slotIndex)];reserve.disabled=!verified;
      root.querySelectorAll('[data-slot-index]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    });
    reserve.onclick=async()=>{
      if(!selected||saving||!verified)return;
      saving=true;reserve.disabled=true;
      try{
        await api.bookInstitution(profile.id,selected,$('input',root).value);
        status.textContent='Solicitud registrada. Queda pendiente de confirmación.';
        await portalActions.refresh();
      }catch(error){status.textContent=error.message;reserve.disabled=false;}
      finally{saving=false;}
    };
    root.scrollIntoView({block:'start'});
  }

  function professionalAgenda(dialog,mode) {
    const form=$('form',dialog), pending=$('[data-status]',dialog);
    if(!form)return;
    const editor=$('[data-week]',form), shell=document.createElement('section');
    shell.className='hc310ProfessionalAgenda';
    shell.innerHTML='<div data-pro-month></div><section data-day-agenda aria-live="polite"></section>';
    editor.before(shell);
    let visits=[], selected=argentina.format(new Date()), month=toDate(selected), serial=0;
    const dayArea=$('[data-day-agenda]',shell);
    form.hc310SelectWeekday=day=>{
      $('[data-day-tab="'+day+'"]',form)?.click();
      form.querySelectorAll('[data-day]').forEach(field=>{field.hidden=Number(field.dataset.day)!==day;});
    };
    function showDay(key) {
      selected=key;
      const day=toDate(key).getDay();
      form.hc310SelectWeekday(day);
      const rows=visits.filter(v=>argentina.format(new Date(v.starts_at))===key).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
      dayArea.innerHTML='<h3>'+E(dayLabel(key))+'</h3>'+
        (rows.length?rows.map(v=>'<button type="button" class="hc310VisitLine" data-agenda-visit="'+E(v.id)+'"><span>'+E(time(v.starts_at))+
          ' · <b>'+E(v.peer_name||'Paciente')+'</b></span><small>'+E(({confirmed:'Confirmado',awaiting_payment:'Pendiente de pago',cancelled:'Cancelado',finished:'Atendido',active:'En atención',expired:'Vencido'})[v.status]||v.status)+'</small></button>').join(''):'<p class="hc310Muted">Sin turnos registrados en este día.</p>')+
        '<p class="hc310Muted">Los cambios de horario se aplican a todos los '+E(toDate(key).toLocaleDateString('es-AR',{weekday:'long'}))+' de la semana.</p>';
      dayArea.querySelectorAll('[data-agenda-visit]').forEach(b=>b.onclick=()=>{
        if($('#hc297Workspace')?.dataset.mode===mode)window.HC310.workspaceOpen(b.dataset.agendaVisit);
        else window.hc297Workspace(mode).then(()=>window.HC310.workspaceOpen?.(b.dataset.agendaVisit));
      });
    }
    const view=calendar($('[data-pro-month]',shell),{month,selected,
      onMonth:value=>{month=value;load();},onDay:showDay,
      getEvents:key=>visits.filter(v=>argentina.format(new Date(v.starts_at))===key).map(v=>
        v.status==='awaiting_payment'?'pending':past.has(v.status)?'past':'future')
    });
    form.querySelectorAll('[data-day-tab]').forEach(tab=>tab.hidden=true);
    showDay(selected);
    async function load() {
      const n=++serial;
      try{
        const value=await window.hc292Tele.api('calendarVisits',{month:keyOf(month).slice(0,7),mode});
        if(n!==serial||!shell.isConnected)return;
        visits=value.visits||[];view.render();showDay(selected);
      }catch(error){if(n===serial&&shell.isConnected)pending.textContent='Turnos de la agenda: '+error.message;}
    }
    load();
  }

  function professionalProfile(mode,user) {
    const el=window.hc289Dialog('Perfil','<div class="hc310Profile"></div><button type="button" data-profile-edit>Editar perfil profesional</button>');
    const box=$('.hc310Profile',el);
    const image=document.createElement('span');avatar(image,user);box.append(image);
    const name=document.createElement('h3');name.textContent=user.name||user.username||'Profesional';box.append(name);
    $('[data-profile-edit]',el).onclick=()=>window.hc292Professional(mode);
  }

  function professionalAlerts(root) {
    const button=$('[data-pro-alerts]',root);if(!button)return;
    let newer=0, notified, loaded=false, busy=false;
    button.onclick=()=>window.hc296Notifications();
    async function check() {
      if(!root.isConnected||document.hidden||busy)return;
      busy=true;
      try{
        const result=await window.hc292Tele.api('notifications');
        if(!root.isConnected)return;
        const unread=(result.notifications||[]).filter(n=>n.kind==='tele_booking'&&!n.read_at);
        newer=unread.length;button.textContent=newer?'Avisos · '+newer:'Avisos';
        button.classList.toggle('hc310NewAlerts',!!newer);
        if(loaded&&unread[0]?.id&&notified!==unread[0].id)window.hc289Toast('Tenés una nueva solicitud de turno.');
        notified=unread[0]?.id;loaded=true;
      }catch{}finally{busy=false;}
    }
    const timer=setInterval(()=>{if(!root.isConnected)clearInterval(timer);else check();},30000);
    check();
  }

  async function privateReports(root) {
    const section=document.createElement('section');
    section.innerHTML='<h3>Estudios de consultas particulares</h3><p role="status">Cargando informes…</p><div data-studies></div>';
    root.append(section);
    const status=$('[role=status]',section), body=$('[data-studies]',section);
    const request=window.hc292Tele.api;
    try{
      const result=await request('myReports');if(!section.isConnected)return;
      const reports=result.reports||[];
      status.textContent=reports.length?'':'Sin informes publicados de consultas particulares.';
      body.innerHTML=reports.map((report,i)=>'<button type="button" class="hc310VisitLine" data-report="'+i+'">'+E(report.name)+'</button>').join('');
      body.querySelectorAll('button').forEach(button=>button.onclick=async()=>{
        if(button.disabled)return;
        const report=reports[Number(button.dataset.report)];
        button.disabled=true;
        const tab=window.open('about:blank','_blank');
        if(tab)tab.opener=null;
        try{
          const file=await request('documentFile',{visitId:report.visit_id,documentId:report.id});
          if(tab)tab.location.href=file.url;
          else{
            const link=document.createElement('a');link.href=file.url;link.target='_blank';
            link.rel='noopener noreferrer';link.textContent='Abrir informe';status.replaceChildren(link);
          }
        }catch(error){tab?.close();status.textContent=error.message;}
        finally{button.disabled=false;}
      });
    }catch(error){if(section.isConnected)status.textContent='No se pudieron consultar los informes: '+error.message;}
  }

  window.HC310={avatar,touch,portalMarkup,sidebar,renderSidebar,calendar,settingsMarkup,bindSettings,closePanel,booking,modeLabel,professionalAgenda,professionalProfile,professionalAlerts,privateReports};
})();
