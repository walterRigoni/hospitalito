(() => {
  'use strict';
  const kilometers = new Intl.NumberFormat('es-AR',{maximumFractionDigits:1});

  function rankProviders(results, origin) {
    const {distance} = window.HC299Geo;
    return results.map(record=>{
      let closest = null;
      for (const location of Array.isArray(record.locations)?record.locations:[]) {
        const km = distance(origin,location);
        if (km!==null && (!closest || km<closest.km)) closest={location,km};
      }
      return {...record,closest};
    }).sort((a,b)=>{
      if(a.closest && b.closest && a.closest.km!==b.closest.km) return a.closest.km-b.closest.km;
      if(Boolean(a.closest)!==Boolean(b.closest)) return a.closest?-1:1;
      return a.profile.name.localeCompare(b.profile.name,'es');
    });
  }

  function distanceLabel(closest) {
    if(!closest)return 'Distancia no disponible';
    const {location,km}=closest;
    const distance=km<1?Math.round(km*1000)+' m':kilometers.format(km)+' km';
    const address=[location.location,location.address].filter(Boolean).join(' · ');
    return 'Sede disponible a '+distance+(address?' · '+address:'');
  }

  window.HC315={rankProviders,distanceLabel};
})();
