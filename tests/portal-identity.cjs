const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const parseContext={window:{}};vm.createContext(parseContext);
const parseSource=(()=>{const s=fs.readFileSync(path.join(__dirname,'../ui/v290-portal.js'),'utf8');return s.slice(s.indexOf('function parseIdentity(raw){'),s.indexOf('let ocrReady=null;'));})();
vm.runInContext(parseSource,parseContext);
const parse=text=>JSON.parse(JSON.stringify(parseContext.window.hc289ParseIdentity(text)));
const cases=[
  ['APELLIDO / SURNAME\nPRUEBA\nNOMBRES / GIVEN NAMES\nANA MARIA\nDOCUMENTO / DOCUMENT\n99.000.001\nFECHA DE NACIMIENTO / DATE OF BIRTH\n14 NOV / NOV 1980',{name:'ANA MARIA PRUEBA',dni:'99000001',dob:'1980-11-14'}],
  ['Apellido: FERREYRA\nNombre: ANA MARIA\nDNI: 25.281.448\nNacimiento: 12/11/1976',{name:'ANA MARIA FERREYRA',dni:'25281448',dob:'1976-11-12'}],
  ['Surname\nPRUEBA\nGiven names\nANA MARIA\nDate of birth\n14 NOV 1980\nDocumento 99000001',{name:'ANA MARIA PRUEBA',dni:'99000001',dob:'1980-11-14'}],
  ['DOCUMENTO\n9.000.001\nNACIMIENTO\n01 AGO / AUG 2001',{name:'',dni:'9000001',dob:'2001-08-01'}],
  ['Fecha de emisión\n01/01/2022\nFecha de nacimiento\n14-11-1980\nVencimiento\n01/01/2037',{name:'',dni:'',dob:'1980-11-14'}],
  ['NACIMIENTO 31/02/1980',{name:'',dni:'',dob:''}],
  ['NACIMIENTO 01/01/2099',{name:'',dni:'',dob:''}],
  ['TRÁMITE\n12345678\nCUIL\n27-99000001-8',{name:'',dni:'',dob:''}],
  ['', {name:'',dni:'',dob:''}],
  ['DOCUMENTO\n99000001\nNACIMIENTO\n14/11/1980',{name:'',dni:'99000001',dob:'1980-11-14'}],
  ['APELLIDO\nNOMBRES\nNACIMIENTO',{name:'',dni:'',dob:''}]
];
for(const [input,expected]of cases)assert.deepEqual(parse(input),expected,input);
console.log('PASS: '+cases.length+' identity-parser scenarios.');
