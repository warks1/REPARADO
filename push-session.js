// Control de notificaciones ligado a la cuenta activa del dispositivo.
// No envía push remoto. Requiere migración V24 y backend de envío auditado.
export function createPushSessionManager({supabase, Capacitor, PushNotifications, onError=()=>{}}){
  let owner=null, token=null, listeners=[], active=false, starting=false;
  let generation=0, pendingRegistration=Promise.resolve();

  const native=()=>Boolean(Capacitor.isNativePlatform());
  async function removeListeners(){
    const previous=listeners.splice(0);
    await Promise.allSettled(previous.map(handle=>handle.remove()));
  }
  async function activate(userId){
    if(!userId || !native())return false;
    if(owner===userId && (active || starting))return true;
    if(starting)return false;
    const currentGeneration=++generation;
    starting=true;
    try{
      await removeListeners();
      const permissions=await PushNotifications.requestPermissions();
      if(permissions.receive!=='granted' || currentGeneration!==generation)return false;
      owner=userId;token=null;active=false;
      listeners.push(await PushNotifications.addListener('registration', ({value})=>{
        if(currentGeneration!==generation || owner!==userId || !value)return;
        const registeredToken=value;
        pendingRegistration=pendingRegistration.catch(()=>{}).then(async()=>{
          const {data,error}=await supabase.rpc('reparado_register_device',{
            p_token:registeredToken,p_platform:Capacitor.getPlatform()
          });
          if(error || data!==true)throw new Error('Registro de notificaciones no disponible');
          // Guardar incluso si logout ha comenzado: se revocará al terminar
          // la operación en vuelo. Nunca enviar el token a registros o consola.
          if(owner===userId)token=registeredToken;
        }).catch(onError);
      }));
      listeners.push(await PushNotifications.addListener('registrationError',()=>{
        onError(new Error('No se pudo registrar el dispositivo para notificaciones'));
      }));
      await PushNotifications.register();
      active=true;
      return true;
    }catch(error){
      onError(error);
      await removeListeners();
      owner=null;token=null;active=false;
      return false;
    }finally{starting=false}
  }
  async function deactivate(userId){
    if(!native() || !owner)return true;
    if(owner!==userId)return false;
    // Bloquear callbacks nuevos y esperar a cualquier RPC ya iniciada.
    generation++;
    await pendingRegistration.catch(()=>{});
    if(token){
      try{
        const {error}=await supabase.rpc('reparado_revoke_device',{p_token:token});
        if(error)throw error;
      }catch(error){
        onError(error);
        return false; // Sin confirmación no se cambia de cuenta.
      }
    }
    await removeListeners();
    owner=null;token=null;active=false;
    return true;
  }
  async function discard(){
    generation++;
    await removeListeners();
    owner=null;token=null;active=false;
  }
  return {activate,deactivate,discard};
}
