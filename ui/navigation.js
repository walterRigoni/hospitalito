/* v300: visible navigation uses the latest logout routine, including admin overlays. */
(()=>{'use strict';
const q=s=>document.querySelector(s);let leaving=false;
async function returnLogin(){
 if(leaving)return;leaving=true;
 try{
  window.hc280PersistDrafts?.();
  q('.hc292Video [data-close]')?.click();
  if(window.hc289ClientSession){await window.hc289ClientAccount('logout');return;}
  const exit=typeof window.logout==='function'?window.logout:typeof logout==='function'?logout:null;if(!exit)throw Error('No se encontró la salida de la cuenta.');await exit();
  window.hcSettingsClose?.();if(typeof hcInstitutionChooserClose==='function')hcInstitutionChooserClose();
  for(const id of ['hc297Workspace','hc289Dialog','hc280Lock','hc280Security'])document.getElementById(id)?.remove();
  for(const id of ['hc229ShiftModal','hc229AccountingModal','hc231PlatformPage','hc232GlobalChatWindow','hc232CallWindow','hc232CallLobby']){const el=document.getElementById(id);el?.classList.remove('show');el?.setAttribute('aria-hidden','true');}
  window.hc280Locked=false;document.body.classList.remove('hc280IsLocked','hcSeedTool','hcObserver','hc284Accountant');document.body.style.overflow='';
  document.querySelectorAll('#appMed,#appAdmin,#hc231PlatformPage,#hc284AccountPage').forEach(el=>el.inert=false);
  if(typeof showLogin==='function')showLogin();
  decorate();q('#loginWrap input:not([type=hidden])')?.focus();
 }catch(e){window.hc289Toast?.(e.message);}finally{leaving=false;}
}
window.hc300ReturnLogin=returnLogin;
function addPanelExit(root){if(!root||root.querySelector(':scope > [data-hc300-panel-nav]'))return;const nav=document.createElement('nav');nav.dataset.hc300PanelNav='';nav.className='hc300PanelNav';nav.innerHTML='<button type="button" data-hc300-login title="Volver al ingreso" aria-label="Volver al ingreso de usuario y contraseña">↩</button><button type="button" data-hc300-login title="Cerrar administración y salir" aria-label="Cerrar administración y volver al ingreso">×</button>';root.prepend(nav);}
function decorate(){
 const authenticated=!!(typeof session!=='undefined'&&session)||!!window.hc289ClientSession||!!(typeof hcGlobalPendingAuth!=='undefined'&&hcGlobalPendingAuth);
 let exit=q('#hc300GlobalExit');if(!exit){exit=document.createElement('button');exit.id='hc300GlobalExit';exit.type='button';exit.dataset.hc300Login='';exit.textContent='↩';exit.title='Volver al ingreso · salir de la cuenta';exit.setAttribute('aria-label','Volver al ingreso de usuario y contraseña');document.body.append(exit);}exit.hidden=!authenticated;exit.inert=false;
 addPanelExit(q('#appAdmin'));addPanelExit(q('#hc231PlatformPage'));
 const chooser=q('#btnCloseInstitutionChooser');if(chooser){chooser.textContent='×';chooser.title='Cerrar selección';chooser.setAttribute('aria-label','Cerrar selección de ámbito');}
 for(const el of document.querySelectorAll('.hc289Dialog')){const close=el.querySelector('[data-289-close],[data-292-close]');if(!close||el.querySelector('[data-hc300-dialog-back]'))continue;close.textContent='×';close.title='Cerrar';close.setAttribute('aria-label','Cerrar ventana');const back=document.createElement('button');back.type='button';back.dataset.hc300DialogBack='';back.className='hc300DialogBack';back.textContent='↩';back.title='Volver a la pantalla anterior';back.setAttribute('aria-label','Volver a la pantalla anterior');back.onclick=()=>close.click();close.insertAdjacentElement('afterend',back);}
}
document.addEventListener('click',e=>{
 if(e.target.closest?.('[data-hc300-login]')){e.preventDefault();e.stopImmediatePropagation();returnLogin();return;}
 if(e.target.closest?.('[data-hc289-menu=logout],#hc299ShiftLogin,#btnLogout')){e.preventDefault();e.stopImmediatePropagation();returnLogin();return;}
 const privateExit=e.target.closest?.('#hc297Workspace [data-exit]');if(privateExit){e.preventDefault();e.stopImmediatePropagation();returnLogin();}
},true);
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||document.querySelector('.hc289Dialog,dialog[open],.hc292Video,.hcSettingsOverlay'))return;const close=q('#hc292Provider [data-hc300-close-profile]');if(close){e.preventDefault();close.click();}},true);
const previous=typeof syncSessionUI==='function'?syncSessionUI:null;if(previous){const wrapped=function(){const result=previous.apply(this,arguments);decorate();return result;};syncSessionUI=window.syncSessionUI=wrapped;}
const observer=new MutationObserver(()=>decorate());observer.observe(document.body,{childList:true});setInterval(decorate,1200);decorate();
})();
