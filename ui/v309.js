/* Keep the original forms and their in-flight work while changing what the user sees. */
(() => {
  const button = (text, handler, className = '') => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = text;
    element.onclick = handler;
    return element;
  };

  function registration(dialog, form, photoError, closeCamera, validLogin) {
    const status = form.querySelector('#hc289SignupStatus');
    const login = form.querySelector('#hc290ExistingLogin');
    const submit = form.querySelector('[type=submit]');
    const fields = [...form.children];
    const steps = [];
    let active = 0;
    for (const element of fields) {
      if (element === status || element === login || element === submit) continue;
      if (element.matches('.hc290Step')) {
        const section = document.createElement('section');
        section.className = 'hc309RegistrationStep';
        element.tabIndex = -1;
        form.append(section);
        steps.push(section);
      }
      steps.at(-1).append(element);
    }

    const progress = document.createElement('ol');
    progress.className = 'hc309RegistrationProgress';
    progress.setAttribute('aria-label', 'Pasos del registro');
    for (const label of ['Acceso', 'Fotos del DNI', 'Revisar datos']) {
      const item = document.createElement('li');
      item.textContent = label;
      progress.append(item);
    }
    form.before(progress);
    const actions = document.createElement('footer');
    actions.className = 'hc309RegistrationActions';
    const previous = button('Anterior', () => show(active - 1));
    const next = button('Continuar', advance, 'hc289Primary');
    actions.append(status, previous, next, submit, login);
    form.append(actions);
    function show(index, moveFocus = true) {
      if (active === 1 && index !== 1) closeCamera();
      active = index;
      steps.forEach((step, number) => {
        step.hidden = number !== index;
        if (number === index) progress.children[number].setAttribute('aria-current', 'step');
        else progress.children[number].removeAttribute('aria-current');
      });
      previous.hidden = index === 0;
      submit.hidden = index !== 2;
      login.hidden = index !== 0;
      next.hidden = index === 2;
      if (moveFocus) {
        status.textContent = '';
        steps[index].querySelector('h3').focus({preventScroll: true});
        dialog.scrollTop = 0;
      }
    }
    function firstInvalid(section) {
      return [...section.querySelectorAll('input, select')].find(field => field.willValidate && !field.validity.valid);
    }
    function revealInvalid(field) {
      field.focus();
      field.reportValidity();
    }
    function advance() {
      const username = form.elements.username;
      if (active === 0) {
        username.value = username.value.trim();
        if (username.value && !validLogin(username.value.toLowerCase())) {
          username.setCustomValidity('Ingresá un correo válido o un nombre de usuario sin espacios.');
        }
      }
      const invalid = firstInvalid(steps[active]);
      if (invalid) return revealInvalid(invalid);
      if (active === 1) {
        const message = photoError();
        if (message) {
          status.textContent = message;
          return;
        }
      }
      show(active + 1);
    }
    form.addEventListener('submit', event => {
      if (active === 2) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      advance();
    }, true);
    form.classList.add('hc309Registration');
    show(0, false);
    return {
      show,
      validateAll() {
        for (const [index, step] of steps.entries()) {
          const invalid = firstInvalid(step);
          if (!invalid) continue;
          show(index);
          revealInvalid(invalid);
          return false;
        }
        return true;
      }
    };
  }

  function focusAgenda(field) {
    const details = field.closest('details');
    if (details) details.open = true;
    const row = field.closest('[data-day]');
    if (row) row.closest('form').querySelector('[data-day-tab="' + row.dataset.day + '"]')?.click();
    field.focus();
  }

  function agendaValid(form, mode) {
    const status = form.querySelector('[data-save]');
    status.textContent = '';
    const invalid = form.querySelector(':is(input,select,textarea):invalid');
    if (invalid) {
      status.textContent = invalid.validationMessage;
      focusAgenda(invalid);
      invalid.reportValidity();
      return false;
    }
    function reject(field, message) {
      status.textContent = message;
      focusAgenda(field);
      return false;
    }
    const enabled = form.elements.enabled.checked;
    const days = [...form.querySelectorAll('[data-day]')];
    for (const day of days) {
      const active = day.querySelector('[data-active]');
      const name = day.getAttribute('aria-label') || day.querySelector('legend').textContent.trim();
      const blocks = [...day.querySelectorAll('.hc297Window')].map(block => ({
        start: block.querySelector('[data-start]'),
        end: block.querySelector('[data-end]'),
        address: block.querySelector('[data-address]')
      }));
      if (active.checked && !blocks.length) return reject(day.querySelector('[data-add]'), name + ': agregá un horario.');
      for (const block of blocks) {
        if (!block.start.value || !block.end.value || block.start.value >= block.end.value) {
          return reject(block.end, name + ': la hora de fin tiene que ser posterior al inicio.');
        }
        if (enabled && active.checked && mode === 'office' && !block.address.value.trim()) {
          return reject(block.address, name + ': agregá la dirección del consultorio.');
        }
      }
      blocks.sort((a, b) => a.start.value.localeCompare(b.start.value));
      for (let index = 1; index < blocks.length; index++) {
        if (blocks[index].start.value < blocks[index - 1].end.value) {
          return reject(blocks[index].start, name + ': este horario se superpone con otro.');
        }
      }
    }
    const rates = [...form.querySelectorAll('[data-rate]')];
    if (enabled && !days.some(day => day.querySelector('[data-active]').checked)) {
      return reject(days[1].querySelector('[data-active]'), 'Marcá al menos un día de atención.');
    }
    if (enabled && !rates.some(rate => rate.value)) return reject(rates[0], 'Ingresá una tarifa para al menos una duración.');
    return true;
  }

  function bindAgenda(form) {
    const dialog = form.closest('[role=dialog]');
    dialog.classList.add('hc309Agenda');
    form.querySelectorAll('[data-add]').forEach(add => {
      add.textContent = '+ Horario';
      add.title = 'Agregar horario';
    });
    form.querySelector('[data-edit]').addEventListener('click', () => {
      form.querySelector('[type=submit]').focus();
    });
    form.elements.public_visible.addEventListener('change', () => {
      if (form.elements.public_visible.checked) form.elements.consent.focus();
    });
  }

  window.HC309 = {registration, agendaValid, bindAgenda};
})();
