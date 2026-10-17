/* Hospitalito: herramientas locales por especialidad. Sin acceso a red ni guardado clínico. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HospitalitoSpecialtyTools=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DAY=86400000,tools=new Map();
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function dateValue(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))throw new Error('Completá una fecha válida.');
    const stamp=Date.parse(value+'T00:00:00Z');
    if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==value)throw new Error('Completá una fecha válida.');
    return stamp;
  }
  function dueDate({lmp,reference,cycleDays=28,regularity='regular'}){
    if(regularity!=='regular')throw new Error('Con FUM incierta o ciclos irregulares, la fecha debe establecerse con la evaluación obstétrica y la ecografía.');
    const start=dateValue(lmp),at=dateValue(reference),cycle=Number(cycleDays);
    if(String(cycleDays).trim()===''||!Number.isInteger(cycle)||cycle<15||cycle>60)throw new Error('Revisá la duración del ciclo: ingresá días enteros entre 15 y 60. Fuera de ese rango corresponde una evaluación obstétrica.');
    if(start>at)throw new Error('La FUM no puede ser posterior a la fecha de referencia.');
    const due=start+(280+cycle-28)*DAY,days=280-Math.round((due-at)/DAY);
    if(days<0||days>315)throw new Error('Revisá las fechas y la duración del ciclo: la edad gestacional queda fuera del intervalo de esta calculadora (0 a 45 semanas).');
    return {dueDate:new Date(due).toISOString().slice(0,10),weeks:Math.floor(days/7),days:days%7,gestationalDays:days,cycleDays:cycle};
  }
  function register(tool){
    if(!tool||!/^[-a-z0-9]+$/.test(tool.id||'')||!tool.title||!Array.isArray(tool.specialties)||!tool.specialties.length)throw new Error('Definición de herramienta incompleta.');
    if(tools.has(tool.id))throw new Error('Ya existe esa herramienta.');
    if(!['calculator','table','risk','reference'].includes(tool.kind))throw new Error('Tipo de herramienta inválido.');
    if(['calculator','risk'].includes(tool.kind)&&(!Array.isArray(tool.fields)||typeof tool.calculate!=='function'))throw new Error('La herramienta debe definir sus campos y cálculo.');
    if(['table','reference'].includes(tool.kind)&&(!Array.isArray(tool.columns)||!Array.isArray(tool.rows)))throw new Error('La tabla debe definir columnas y filas.');
    if(!tool.source?.url||!/^https:\/\//.test(tool.source.url))throw new Error('La herramienta necesita una referencia clínica HTTPS.');
    tools.set(tool.id,Object.freeze({...tool,specialties:Object.freeze([...tool.specialties])}));
    return tool.id;
  }
  function list(specialty=''){
    const query=normalize(specialty);
    return [...tools.values()].filter(tool=>!query||query==='todas las especialidades'||tool.specialties.some(s=>normalize(s)===query));
  }
  function formatDate(iso){const [year,month,day]=iso.split('-');return day+'/'+month+'/'+year;}
  register({id:'obstetric-due-date',title:'Gestograma: fecha probable de parto',kind:'calculator',version:'1',specialties:['Ginecología y Obstetricia','Ginecología','Obstetricia'],
    description:'Estimación por fecha de última menstruación (FUM) y duración de un ciclo regular.',
    source:{title:'Merck Manual: evaluación obstétrica',url:'https://www.merckmanuals.com/professional/gynecology-and-obstetrics/approach-to-the-pregnant-woman-and-prenatal-care/evaluation-of-the-obstetric-patient'},
    fields:[{id:'lmp',label:'Primer día de la última menstruación',type:'date',required:true},{id:'cycleDays',label:'Duración habitual del ciclo (días)',type:'number',min:15,max:60,step:1,value:28,required:true},{id:'reference',label:'Fecha para calcular la edad gestacional',type:'date',defaultToday:true,required:true},{id:'regularity',label:'FUM y regularidad del ciclo',type:'select',value:'regular',options:[{value:'regular',label:'FUM conocida y ciclos regulares'},{value:'uncertain',label:'FUM incierta o ciclos irregulares'}]}],
    calculate:values=>{const result=dueDate(values);return{title:'Estimación obstétrica',lines:[['Fecha probable de parto',formatDate(result.dueDate)],['Edad gestacional al '+formatDate(values.reference),result.weeks+(result.weeks===1?' semana':' semanas')+' y '+result.days+(result.days===1?' día':' días')],['FUM',formatDate(values.lmp)],['Ciclo regular',result.cycleDays+' días']],note:'Estimación por FUM. Confirmar la datación con ecografía y criterio obstétrico. No reemplaza ni modifica una fecha probable de parto ya establecida.'};}
  });
  return Object.freeze({register,list,dueDate,formatDate,normalize});
});
