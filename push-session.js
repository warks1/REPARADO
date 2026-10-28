// Control de notificaciones ligado a la cuenta activa del dispositivo.
// No envía push remoto. Requiere migración V24 y backend de envío auditado.
export function createPushSessionManager({supabase, Capacitor, PushNotifications, onError=()=>{}}){
  let owner=null, token=null, listeners=[], active=false, starting=false;
  // Una rotación del token deja el anterior pendiente de baja hasta confirmarla.
  const retiredTokens=new Set();
  // Respuesta de registro perdida: el servidor podría haber aceptado el token.
  const uncertainTokens=new Set();
  let generation=0, pendingRegistration=Promise.resolve();
  // Un cierre externo no puede revocar tokens con una sesión ya invalidada.
  // Conservar la deuda de revocación y no permitir otra cuenta hasta resolverla.
  let suspended=false, listenerCleanup=Promise.resolve();

  const native=()=>Boolean(Capacitor.isNativePlatform());
  async function removeListeners(){
    const previous=listeners.splice(0);
    await Promise.allSettled(previous.map(handle=>handle.remove()));
  }
  async function activate(userId){
    if(!userId || !native())return false;
    if(suspended && owner){
      // B nunca hereda un token que todavía puede pertenecer a A.
      if(owner!==userId)return false;
      // Al volver A con una sesión válida, revocar primero cualquier token
      // antiguo/ambiguo y sólo entonces solicitar un registro nuevo.
      if(!await deactivate(userId))return false;
    }
    if(suspended){await listenerCleanup;suspended=false;}
    if(owner===userId && (active || starting))return true;
    // Sin revocación confirmada nunca se pasa de una cuenta a otra.
    if(owner && owner!==userId)return false;
    if(starting)return false;
    const currentGeneration=++generation;
    starting=true;
    // Asociar el usuario ANTES de pedir permisos: logout podrá invalidar
    // una ventana de permisos que siga abierta.
    owner=userId;token=null;active=false;
    try{
      await removeListeners();
      const permissions=await PushNotifications.requestPermissions();
      if(permissions.receive!=='granted' || currentGeneration!==generation)return false;
      const registrationListener=await PushNotifications.addListener('registration', ({value})=>{
        if(currentGeneration!==generation || owner!==userId || !value)return;
        const registeredToken=value;
        uncertainTokens.add(registeredToken);
        pendingRegistration=pendingRegistration.catch(()=>{}).then(async()=>{
          const {data,error}=await supabase.rpc('reparado_register_device',{
            p_token:registeredToken,p_platform:Capacitor.getPlatform()
          });
          if(error || data!==true)throw new Error('Registro de notificaciones no disponible');
          uncertainTokens.delete(registeredToken);
          // Guardar incluso si logout ha comenzado: deactivation espera esta
          // secuencia. No dejar dos tokens activos después de una rotación.
          if(owner===userId){
            if(token && token!==registeredToken)retiredTokens.add(token);
            token=registeredToken;
            for(const oldToken of [...retiredTokens]){
              const result=await supabase.rpc('reparado_revoke_device',{p_token:oldToken});
              if(result.error)throw new Error('No se pudo revocar el token anterior');
              retiredTokens.delete(oldToken);
            }
          }
        }).catch(onError);
      });
      if(currentGeneration!==generation){await registrationListener.remove();return false;}
      listeners.push(registrationListener);
      const failureListener=await PushNotifications.addListener('registrationError',()=>{
        onError(new Error('No se pudo registrar el dispositivo para notificaciones'));
      });
      if(currentGeneration!==generation){await failureListener.remove();return false;}
      listeners.push(failureListener);
      await PushNotifications.register();
      if(currentGeneration!==generation)return false;
      active=true;
      return true;
    }catch(error){
      onError(error);
      // Un fallo nativo puede llegar DESPUÉS de que el backend haya recibido
      // el token. No olvidar el propietario ni los registros inciertos.
      // Si logout ya invalidó esta generación, su propia limpieza manda.
      if(currentGeneration===generation && owner===userId){
        generation++;
        active=false;suspended=true;
        listenerCleanup=removeListeners();
        await listenerCleanup;
      }
      return false;
    }finally{starting=false}
  }
  async function deactivate(userId){
    if(!native() || !owner)return true;
    if(owner!==userId)return false;
    // Bloquear callbacks nuevos y esperar a cualquier RPC ya iniciada.
    generation++;
    await listenerCleanup;
    await pendingRegistration.catch(()=>{});
    for(const deviceToken of new Set([...uncertainTokens,...retiredTokens,...(token?[token]:[])])){
      try{
        const {error}=await supabase.rpc('reparado_revoke_device',{p_token:deviceToken});
        if(error)throw error;
        retiredTokens.delete(deviceToken);
        uncertainTokens.delete(deviceToken);
        if(token===deviceToken)token=null;
      }catch(error){
        onError(error);
        return false; // Sin confirmar todas las bajas no se cambia de cuenta.
      }
    }
    await removeListeners();
    owner=null;token=null;retiredTokens.clear();uncertainTokens.clear();active=false;suspended=false;
    return true;
  }
  function suspend(){
    // onAuthStateChange debe invalidar callbacks ANTES de que se procese
    // un nuevo login; nunca descartar el registro pendiente sin revocarlo.
    generation++;
    active=false;
    suspended=Boolean(owner);
    listenerCleanup=removeListeners();
    return listenerCleanup;
  }
  return {activate,deactivate,suspend};
}
