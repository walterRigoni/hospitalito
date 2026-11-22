(() => {
  'use strict';

  const argentina = 'America/Argentina/Buenos_Aires';
  const defaults = {dateFormat:'dmy',timeFormat:'24h'};
  const pad = value => String(value).padStart(2,'0');
  const zones = new Map();
  let viewer, settings=defaults;
  function setPreferences(visual={}) {
    viewer=window.hc313Viewer?.();
    settings={
      dateFormat:visual.dateFormat==='iso'?'iso':defaults.dateFormat,
      timeFormat:visual.timeFormat==='12h'?'12h':defaults.timeFormat
    };
    return settings;
  }
  function preferences() {
    if (viewer!==window.hc313Viewer?.()) return setPreferences(window.hc289Visual?.());
    return settings;
  }

  function parts(value, options) {
    if (typeof value === 'string') {
      const text = value.trim();
      const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i.exec(text);
      if (iso && !(options.timeZone && iso[4] && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text))) {
        const [,year,month,day,hour,minute,second] = iso;
        return {year,month,day,hour,minute,second};
      }
      const legacyDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
      if (legacyDate) return {day:pad(legacyDate[1]),month:pad(legacyDate[2]),year:legacyDate[3]};
      const clock = /^(\d{1,2})(?::([0-5]\d)(?::([0-5]\d))?)?(?:\s*([ap])\.?\s*m\.?)?$/i.exec(text);
      if (clock && (clock[2] || clock[4])) {
        const n = Number(clock[1]);
        const minute=clock[2]||'00';
        if (n > 24 || (n===24 && (minute!=='00'||Number(clock[3]||0)))) return {};
        const hour = clock[4] && n<=12 ? n%12+(clock[4].toLowerCase()==='p'?12:0) : n%24;
        return {hour:pad(hour),minute,second:clock[3]};
      }
      if (!iso) return {};
    }
    if (value==null || value==='') return {};
    const timestamp = new Date(value);
    if (!Number.isFinite(+timestamp)) return {};
    if (options.timeZone) {
      if (!zones.has(options.timeZone)) zones.set(options.timeZone,new Intl.DateTimeFormat('en-GB',{
        timeZone:options.timeZone,year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
      }));
      return Object.fromEntries(zones.get(options.timeZone).formatToParts(timestamp).map(({type,value})=>[type,value]));
    }
    return {
      year:timestamp.getFullYear(),month:pad(timestamp.getMonth()+1),day:pad(timestamp.getDate()),
      hour:pad(timestamp.getHours()),minute:pad(timestamp.getMinutes()),second:pad(timestamp.getSeconds())
    };
  }

  function formatDate(fields, settings, short) {
    if (!fields.year) return '';
    if (settings.dateFormat==='iso') return short?fields.month+'-'+fields.day:[fields.year,fields.month,fields.day].join('-');
    return short?fields.day+'/'+fields.month:[fields.day,fields.month,fields.year].join('/');
  }

  function formatTime(fields, settings, seconds) {
    if (fields.hour===undefined) return '';
    const hour = Number(fields.hour)%24;
    const minutes = ':'+fields.minute+(seconds&&fields.second!==undefined?':'+fields.second:'');
    if (settings.timeFormat==='12h') return (hour%12||12)+minutes+(hour<12?' a. m.':' p. m.');
    return pad(hour)+minutes;
  }

  function date(value, options={}) {
    return formatDate(parts(value,options),preferences(),options.short);
  }
  function time(value, options={}) {
    return formatTime(parts(value,options),preferences(),options.seconds);
  }
  function dateTime(value, options={}) {
    const fields=parts(value,options), settings=preferences();
    return [formatDate(fields,settings,options.short),formatTime(fields,settings,options.seconds)].filter(Boolean).join(' ');
  }

  function dayLabel(value) {
    const fields=parts(value,{});
    if (!fields.year) return '';
    const day=new Date(fields.year+'-'+fields.month+'-'+fields.day+'T12:00:00');
    const weekday=day.toLocaleDateString('es-AR',{weekday:'long'});
    return weekday+' '+formatDate(fields,preferences());
  }

  function settingsMarkup() {
    const current=preferences();
    const select=(name,options)=>'<select data-hc313-format="'+name+'">'+options.map(([value,label])=>
      '<option value="'+value+'"'+(value===current[name]?' selected':'')+'>'+label+'</option>').join('')+'</select>';
    return '<fieldset class="hc313Format"><legend>Fecha y hora</legend><div>'+
      '<label>Formato de fecha'+select('dateFormat',[['dmy','12/11/2026'],['iso','2026-11-12']])+'</label>'+
      '<label>Formato de hora'+select('timeFormat',[['24h','13:00 (24 horas)'],['12h','1:00 p. m. (12 horas)']])+'</label>'+
      '</div></fieldset>';
  }

  window.HC313 = {argentina,date,time,dateTime,dayLabel,settingsMarkup,setPreferences};
})();
