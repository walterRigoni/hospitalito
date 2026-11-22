(() => {
  'use strict';

  function orientationScore(result) {
    const data = result.data || {};
    const text = String(data.text || '').normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
    const headings = text.match(/\b(?:ARGENTINA|REPUBLICA|DOCUMENTO|APELLIDOS?|NOMBRES?|NACIMIENTO|NACIONALIDAD|DOMICILIO|EJEMPLAR|VENCIMIENTO|EMISION|TRAMITE|RENAPER|SURNAME|BIRTH)\b/g);
    const machineReadable = text.split('\n').some(line => /^I[D<]ARG[0-9<]{5,}/.test(line.replace(/\s/g, '')));
    const landmarks = new Set(headings).size + (machineReadable ? 3 : 0);
    const confidence = Math.min(100, Math.max(0, Number(data.confidence) || 0));
    return {landmarks, value: landmarks * 2 + confidence / 100};
  }

  async function readDirection(canvas, read, isCurrent) {
    const first = await read(canvas);
    if (!isCurrent()) return null;

    const opposite = document.createElement('canvas');
    opposite.width = canvas.width;
    opposite.height = canvas.height;
    const context = opposite.getContext('2d');
    context.translate(opposite.width, opposite.height);
    context.rotate(Math.PI);
    context.drawImage(canvas, 0, 0);
    try {
      const second = await read(opposite);
      if (!isCurrent()) return null;
      const initial = orientationScore(first);
      const reversed = orientationScore(second);
      const flip = reversed.landmarks >= 2 && reversed.value - initial.value >= 1.5;
      return {flip, result: flip ? second : first};
    } finally {
      opposite.width = opposite.height = 1;
    }
  }

  window.HC316Dni = {readDirection};
})();
