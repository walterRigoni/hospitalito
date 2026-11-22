const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let viewer = 'paciente';
const accounts = {paciente:{},profesional:{dateFormat:'iso',timeFormat:'12h'}};
const window = {hc313Viewer:()=>viewer,hc289Visual:()=>accounts[viewer]};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ui/v313.js'),'utf8'),{window,Intl,Date});

const {date,time,dateTime,dayLabel,settingsMarkup,setPreferences,argentina} = window.HC313;
assert.equal(date('2026-11-12'),'12/11/2026');
assert.equal(date('12/11/2026'),'12/11/2026');
assert.equal(time('13:00'),'13:00');
assert.equal(time('13:00 p. m.'),'13:00');
assert.equal(time('12:00 a. m.'),'00:00');
assert.equal(time('24:00'),'00:00');
assert.equal(time('25:00'),'');
assert.equal(time('13:00:12',{seconds:true}),'13:00:12');
assert.equal(dateTime('2026-11-12T13:00'),'12/11/2026 13:00');
assert.equal(dateTime('2026-11-12 13:00:00'),'12/11/2026 13:00');
assert.equal(dateTime('2026-11-13T01:00:00Z',{timeZone:argentina}),'12/11/2026 22:00');
assert.equal(dateTime('2026-11-12T16:00:00+00:00',{timeZone:argentina}),'12/11/2026 13:00');
assert.equal(date('2026-11-12',{timeZone:argentina}),'12/11/2026');
assert.equal(date('2026-11-12',{short:true}),'12/11');
assert.equal(dateTime(null),'');
assert.equal(dateTime('sin horario'),'');
assert.match(dayLabel('2026-11-12'),/jueves 12\/11\/2026/);
assert.match(settingsMarkup(),/value="dmy" selected/);

viewer='profesional';
assert.equal(dateTime('2026-11-12T13:00'),'2026-11-12 1:00 p. m.');
assert.equal(time('12:00'),'12:00 p. m.');
assert.equal(time('00:00'),'12:00 a. m.');
assert.equal(date('2026-11-12',{short:true}),'11-12');
assert.match(settingsMarkup(),/value="12h" selected/);

viewer='paciente';
assert.equal(dateTime('2026-11-12T13:00'),'12/11/2026 13:00','user choices remain isolated');
setPreferences({dateFormat:'iso',timeFormat:'24h'});
assert.equal(dateTime('2026-11-12T13:00'),'2026-11-12 13:00','the settings work independently');
setPreferences({dateFormat:'other',timeFormat:'other'});
assert.equal(dateTime('2026-11-12T13:00'),'12/11/2026 13:00','invalid persisted choices use defaults');
console.log('PASS formatos de fecha y hora, medianoche y mediodía, zona argentina y separación por cuenta.');
