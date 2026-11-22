(() => {
  'use strict';
  const esc = window.hc289Esc;
  const unavailable = 'El servicio de acceso no está disponible por el momento. Volvé a intentar en unos minutos.';
  const transient = /upstream connect|connection failure|connection refused|connection reset|transport failure|delayed connect|error:\s*111\b|PGRST00[0-3]|schema cache|statement timeout|could not query the database/i;
  const credentialError = /^(?:Usuario o contraseña incorrectos|Credenciales inválidas|Completá usuario y contraseña|La cuenta no tiene instituciones habilitadas)\.?$/i;

  function accessFailure(retry, message = unavailable) {
    return Object.assign(new Error(message), {noRetry:!retry});
  }

  async function accessResponse(response, action) {
    const contentType = response.headers.get('content-type') || '';
    if (response.status === 429) throw accessFailure(false, 'Hubo demasiados intentos. Esperá un momento y volvé a intentar.');
    if (!/\bapplication\/(?:[\w.+-]+\+)?json\b/i.test(contentType)) throw accessFailure(true);
    let data;
    try { data = await response.json(); }
    catch { throw accessFailure(true); }
    if (response.ok && data?.ok === true) return data;
    const message = typeof data?.error === 'string' ? data.error.trim() : '';
    if (response.status >= 500 || transient.test(message)) throw accessFailure(true);
    if (action === 'authenticateUser') {
      if (/^La cuenta todavía no tiene credenciales Supabase migradas\.?$/i.test(message)) {
        throw Object.assign(accessFailure(true), {legacy:true});
      }
      if (credentialError.test(message)) throw accessFailure(false, message);
      if ([401,403].includes(response.status)) throw accessFailure(false);
      throw accessFailure(true);
    }
    const plain = message.length <= 200 && !/[<>\r\n]/.test(message);
    throw accessFailure(false, plain && message ? message : 'No se pudo verificar tu acceso.');
  }

  async function signIn(url, fallback, key, credentials, onRetry) {
    const regional = new URL(url);
    regional.searchParams.delete('forceFunctionRegion');
    const endpoints = [url, regional.href, fallback];
    let legacy = false;
    for (const [index, endpoint] of endpoints.entries()) {
      if (legacy && index === 1) continue;
      if (index) {
        onRetry?.();
        await new Promise(resolve => setTimeout(resolve, 350));
      }
      try {
        const response = await fetch(endpoint, {
          method:'POST', headers:{'Content-Type':'application/json', apikey:key},
          cache:'no-store', body:JSON.stringify({action:'authenticateUser', ...credentials}),
          signal:AbortSignal.timeout(12000)
        });
        const session = await accessResponse(response, 'authenticateUser');
        if (typeof session.token !== 'string' || !session.token || !session.user?.username) throw accessFailure(true);
        return session;
      } catch (error) {
        if (error.noRetry) throw error;
        legacy = error.legacy === true;
      }
    }
    throw accessFailure(false);
  }

  const fonts = {
    default:'system-ui, sans-serif', system:'system-ui, sans-serif',
    arial:'Arial, sans-serif', georgia:'Georgia, serif', verdana:'Verdana, sans-serif'
  };

  function fontPicker(labels, selected) {
    const current = Object.hasOwn(labels,selected) ? selected : 'default';
    return '<div class="hc311Font"><label id="hc311FontLabel">Fuente tipográfica</label>'+
      '<details><summary aria-labelledby="hc311FontLabel hc311FontValue"><span id="hc311FontValue" style="font-family:'+fonts[current]+'">'+esc(labels[current])+'</span></summary>'+
      '<fieldset aria-labelledby="hc311FontLabel">'+Object.entries(labels).map(([id,label])=>
        '<label style="font-family:'+fonts[id]+'"><input type="radio" name="hc311FontChoice" data-vfont value="'+id+'" '+
        (id===current?'checked':'')+'>'+esc(label)+'</label>').join('')+'</fieldset></details></div>';
  }

  function markPortal(section) {
    const portal = document.querySelector('#hc289Portal');
    portal?.querySelectorAll('[data-portal-section]').forEach(button => {
      if (button.dataset.portalSection === section) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
  }

  function openAccountPanel(portal, panel) {
    const background = [...portal.children];
    background.forEach(node => node.inert = true);
    panel.classList.add('hc311FullAccount');
    const trigger = portal.querySelector('#hc289PortalAccount');
    const dismiss = () => {
      panel.remove();
      background.forEach(node => { if (node.isConnected) node.inert = false; });
      trigger?.focus({preventScroll:true});
    };
    panel.hc311Dismiss = dismiss;
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); dismiss(); }
    });
    portal.append(panel);
  }

  function patientPreferenceKey() {
    return 'hc311.patientReminders.'+window.hc289ClientSession?.user.username;
  }

  function patientReminderPopups() {
    return localStorage.getItem(patientPreferenceKey()) !== 'off';
  }

  function editPatientReminders(panel) {
    const checkbox = panel.querySelector('input[type=checkbox]');
    checkbox.checked = patientReminderPopups();
    checkbox.onchange = () => {
      localStorage.setItem(patientPreferenceKey(), checkbox.checked?'on':'off');
      panel.querySelector('[role=status]').textContent = 'Preferencia guardada en este dispositivo.';
    };
  }

  async function prescriptions(root) {
    const request = window.hc292Tele.api;
    root.innerHTML = '<h2>Mis Recetas</h2><p role="status">Cargando recetas…</p><div data-rx-list></div>';
    const list = root.querySelector('[data-rx-list]'), status = root.querySelector('[role=status]');
    try {
      const {prescriptions:items} = await request('myPrescriptions');
      if (!list.isConnected) return;
      status.textContent = items.length ? '' : 'Todavía no tenés recetas publicadas.';
      for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hc310VisitLine';
        const date = new Date(item.published_at);
        button.textContent = item.name + (Number.isNaN(+date)?'':' · '+date.toLocaleDateString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}));
        button.onclick = async () => {
          button.disabled = true;
          status.textContent = 'Preparando el PDF…';
          try {
            const file = await request('documentFile',{visitId:item.visit_id,documentId:item.id});
            if (!button.isConnected) return;
            const url = new URL(file.url);
            if (url.origin !== 'https://frbuhczonftjtvmviehw.supabase.co' ||
                !url.pathname.startsWith('/storage/v1/object/sign/')) throw Error('El enlace de la receta es inválido.');
            const response = await fetch(url,{credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
            if (!response.ok) throw Error('El enlace venció. Volvé a abrir la receta.');
            const pdf = await response.blob();
            if (!button.isConnected) return;
            const download = document.createElement('a'), temporary = URL.createObjectURL(pdf);
            download.href = temporary;
            download.download = item.name;
            download.click();
            setTimeout(() => URL.revokeObjectURL(temporary), 30000);
            status.textContent = 'PDF listo para descargar.';
          } catch (error) { status.textContent = error.message; }
          finally { button.disabled = false; }
        };
        list.append(button);
      }
    } catch {
      if (!list.isConnected) return;
      status.textContent = 'No se pudieron cargar las recetas.';
      const retry = document.createElement('button');
      retry.type = 'button';retry.textContent = 'Reintentar';
      retry.onclick = () => prescriptions(root);
      list.replaceChildren(retry);
    }
  }

  window.HC311 = {accessResponse, signIn, fontPicker, markPortal, openAccountPanel,
    patientReminderPopups, editPatientReminders, prescriptions};
})();
