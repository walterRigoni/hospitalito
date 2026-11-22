(() => {
  'use strict';
  const esc = value => window.hc289Esc(value);
  const icon = name => window.hc289Icon(name);
  const photoPattern = /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
  const photoTypes = 'image/jpeg,image/png,image/webp,image/gif';

  function sectionHeader(title, action='') {
    return '<div class="hc314SectionHead"><h2 tabindex="-1">'+esc(title)+'</h2><div class="hc314SectionActions">'+action+
      '<button type="button" class="hc311Close" data-hc314-close-section aria-label="Volver al calendario" title="Volver al calendario">'+icon('close')+'</button></div></div>';
  }

  function profileValue(field) {
    if (field.type==='photo') {
      const photo = photoPattern.test(field.value || '') ? field.value : '';
      return '<span class="hc289Avatar hc314ProfilePhoto">'+(photo?'<img alt="Foto de perfil" src="'+photo+'">':icon('user'))+'</span>'+
        '<span>'+ (photo?'Foto guardada':'Sin foto')+'</span>';
    }
    return esc(field.value || 'Sin cargar');
  }

  function profileRows(fields) {
    return '<dl class="hc314Profile" data-hc314-profile>'+fields.map(field=>
      '<div class="hc314ProfileRow" data-hc314-row="'+esc(field.key)+'"><dt>'+esc(field.label)+'</dt>'+
      '<dd><div class="hc314Value">'+profileValue(field)+'</div>'+
      (field.editable?'<button type="button" class="hc314Ghost hc314Pencil hc312IconOnly" data-hc314-edit aria-label="Editar '+esc(field.label)+'" title="Editar '+esc(field.label)+'">'+icon('edit')+'</button>':'')+
      '</dd></div>').join('')+'</dl><p class="hc314ProfileStatus" data-hc314-message role="status"></p>';
  }

  function bindProfile(panel, fields, save) {
    const list = panel.querySelector('[data-hc314-profile]');
    if (!list) return;
    const message = panel.querySelector('[data-hc314-message]');
    let active = null;
    list.querySelectorAll('[data-hc314-edit]').forEach(button=>{
      button.onclick = () => {
        if (active?.busy) return;
        active?.close(false);
        const row=button.closest('[data-hc314-row]'), field=fields.find(item=>item.key===row.dataset.hc314Row);
        const value=row.querySelector('.hc314Value'), editor=document.createElement('form');
        editor.className='hc314Editor';
        editor.dataset.hc314Editor='';
        const content = field.type==='location' ? '<p>Usá la ubicación de este dispositivo.</p>'
          : '<input name="value" type="'+(field.type==='photo'?'file':field.type||'text')+'" aria-label="'+esc(field.label)+'"'+
          (field.type==='photo'?' accept="'+photoTypes+'" required': ' value="'+esc(field.value)+'" maxlength="'+(field.max||200)+'"'+(field.required?' required':''))+
          (field.autocomplete?' autocomplete="'+esc(field.autocomplete)+'"':'')+'>';
        editor.innerHTML=content+'<div class="hc314EditActions"><button type="submit" class="hc314Ghost">'+
          (field.type==='location'?'Guardar ubicación actual':'Guardar')+'</button><button type="button" data-cancel class="hc314Ghost">Cancelar</button></div>';
        button.hidden=true;
        value.hidden=true;
        value.after(editor);
        message.textContent='';
        const current={busy:false,close(restore=true){
          editor.remove();value.hidden=false;button.hidden=false;active=null;
          if(restore)button.focus({preventScroll:true});
        }};
        active=current;
        const submit=editor.querySelector('[type=submit]'), cancel=editor.querySelector('[data-cancel]');
        cancel.onclick=()=>current.close();
        editor.onkeydown=event=>{
          if(event.key==='Escape'){
            event.preventDefault();event.stopPropagation();
            if(!current.busy)current.close();
          }
        };
        editor.onsubmit=async event=>{
          event.preventDefault();
          if(current.busy)return;
          current.busy=true;submit.disabled=true;cancel.disabled=true;message.textContent='Guardando…';
          try {
            const input=editor.elements.value;
            const inputValue=field.type==='photo'?await readPhoto(input.files[0]):input?.value.trim();
            if(field.required&&!inputValue)throw Error('Completá este dato.');
            if(!editor.isConnected)return;
            field.value=await save(field,inputValue);
            if(!editor.isConnected)return;
            value.innerHTML=profileValue(field);
            current.close();
            message.textContent='Dato guardado.';
          } catch(error) {
            if(editor.isConnected)message.textContent=error.message||'No se pudo guardar el dato.';
          } finally {
            current.busy=false;submit.disabled=false;cancel.disabled=false;
          }
        };
        (editor.elements.value||submit).focus();
      };
    });
  }

  async function readPhoto(file) {
    if(!file||!photoTypes.split(',').includes(file.type)||file.size>5000000)throw Error('Elegí una imagen JPG, PNG, WEBP o GIF de hasta 5 MB.');
    const data=await readFileAsDataURL(file);
    if(!photoPattern.test(data))throw Error('La foto no es válida.');
    return data;
  }

  function accountFields(user, role, institution='') {
    return [
      {key:'name',label:'Nombre visible',value:user.name,editable:true,required:true,max:150,autocomplete:'name'},
      {key:'username',label:'Usuario',value:user.username},
      {key:'role',label:'Rol',value:role},
      ...(institution?[{key:'institution',label:'Institución activa',value:institution}]:[]),
      {key:'email',label:'Correo electrónico',value:user.email,editable:true,type:'email',autocomplete:'email'},
      {key:'phone',label:'Teléfono',value:user.phone,editable:true,type:'tel',max:80,autocomplete:'tel'},
      {key:'professionalTitle',label:'Título profesional',value:user.professionalTitle,editable:true,max:150},
      {key:'licenseNumber',label:'Matrícula / identificador',value:user.licenseNumber,editable:true,max:160},
      {key:'specialty',label:'Especialidad / función',value:user.specialty,editable:true,max:200},
      {key:'photo',label:'Foto de perfil',value:user.photo,type:'photo',editable:true}
    ];
  }

  async function saveAccountField(user, field, value) {
    const username=user.username, patch={[field.key]:value};
    const activeUser=()=>session?.username||(document.querySelector('#hc297Workspace')?loadJSON(LS.globalAuthUser,{})?.username:'');
    if(activeUser()!==username)throw Error('Cambió la sesión. Volvé a abrir tu perfil.');
    const authToken=session?.localSeed?'':hcGlobalAuthToken();
    let updated={...user,...patch};
    if(authToken){
      const response=await window.hc230AuthRequest('updateProfile',{token:authToken,user:patch});
      if(activeUser()!==username||hcGlobalAuthToken()!==authToken)throw Error('Cambió la sesión.');
      if(response.user?.username!==username)throw Error('No se confirmó el cambio de perfil.');
      const current=loadJSON(LS.globalAuthUser,{});
      updated={...(current?.username===username?current:user),...patch,...response.user};
      saveJSON(LS.globalAuthUser,updated);
    }
    if(session?.username===username){
      if(authToken)hcGlobalCacheUser({...updated,role:session.role},{id:hcGlobalCurrentInstitutionId(),name:session.institutionName||''});
      else {
        const users=getUsers(),index=users.findIndex(item=>item.username===username);
        if(index<0)throw Error('No se encontró el perfil local.');
        users[index]=hcUserUpdateStamp(users[index],patch);
        setUsers(users);
      }
      if(field.key==='name'){
        session.name=updated.name;
        saveJSON(LS.session,session);
      }
      syncSessionUI?.();
      if(field.key==='name'){
        const brand=document.querySelector('#hcSettingsBrandUser');
        if(brand)brand.textContent=updated.name+' · '+session.role;
      }
    }
    Object.assign(user,updated);
    window.HC310.avatar(document.querySelector('#btnAccount'),updated);
    window.HC310.avatar(document.querySelector('#hc297Workspace [data-pro-profile]'),updated);
    const workspaceName=document.querySelector('#hc297Workspace > header > div > small');
    if(workspaceName&&field.key==='name')workspaceName.textContent=updated.name;
    return updated[field.key];
  }

  window.HC314 = {profileRows,bindProfile,accountFields,saveAccountField,sectionHeader};
})();
