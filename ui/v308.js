/* Use the same clinical navigation buttons and role rules for the mobile picker. */
(() => {
  const tabs = document.querySelector('#hc306ClinicalHeader .medModuleTabs');
  if (!tabs) return;
  const picker = document.createElement('select');
  picker.className = 'hc308ModulePicker';
  picker.setAttribute('aria-label', 'Ir a un módulo de la historia clínica');
  const groups = [
    ['Historia clínica', ['ingreso', 'historia', 'evolucion', 'epicrisis', 'consentimientos']],
    ['Atención diaria', ['prescripciones', 'sv', 'bal', 'invasiones', 'informes_enfermeria', 'monitoreos', 'escalas']],
    ['Estudios y servicios', ['laboratorio', 'micro', 'imagenes', 'nutricion', 'hemoterapia', 'kinesiologia', 'foja_quirurgica', 'consultorios']]
  ];
  function availableTabs() {
    return [...tabs.querySelectorAll('button[data-medtab]')].filter(button =>
      !button.disabled && !button.hidden && !button.closest('[inert]') &&
      getComputedStyle(button).display !== 'none' && getComputedStyle(button).visibility !== 'hidden'
    );
  }
  function syncPicker() {
    const buttons = availableTabs();
    const prompt = new Option('Módulos', '');
    prompt.disabled = true;
    picker.replaceChildren(prompt);
    const assigned = new Set();
    for (const [name, keys] of groups) {
      const group = document.createElement('optgroup');
      group.label = name;
      for (const button of buttons.filter(item => keys.includes(item.dataset.medtab))) {
        group.append(new Option(button.textContent.trim(), button.dataset.medtab));
        assigned.add(button);
      }
      if (group.childElementCount) picker.append(group);
    }
    for (const button of buttons.filter(item => !assigned.has(item))) {
      picker.append(new Option(button.textContent.trim(), button.dataset.medtab));
    }
    picker.value = '';
    picker.hidden = !buttons.length || tabs.hidden || getComputedStyle(tabs).display === 'none';
  }
  picker.onchange = () => {
    const chosen = availableTabs().find(button => button.dataset.medtab === picker.value);
    picker.value = '';
    chosen?.click();
  };
  tabs.before(picker);
  syncPicker();
  picker.addEventListener('pointerdown', syncPicker);
  picker.addEventListener('focus', syncPicker);
  new MutationObserver(syncPicker).observe(tabs, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['style','hidden','disabled']
  });
})();
