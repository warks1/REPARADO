// REPARADO V108 · Recuperación limitada de enlaces firmados de fotos privadas.
// Un <img loading="lazy"> puede descargarse después de caducar su URL de 120 s.
// Solo se intenta firmar una vez más; nunca se convierte el bucket en público.
export function bindWorkPhotoRetry({image,link,gallery,store,path,isActive,onUnavailable}){
  if(!image?.addEventListener||!link||!gallery||!store?.createSignedUrl||
     typeof path!=='string'||!path||typeof isActive!=='function'||
     typeof onUnavailable!=='function'){
    throw new TypeError('Vista privada de fotografía inválida.');
  }
  let retried=false,failed=false;
  // Asegura que un render obsoleto o una sesión cerrada no puedan
  // inyectar otro enlace privado en una pantalla nueva.
  const current=()=>isActive()&&Boolean(image.isConnected)&&Boolean(link.isConnected);
  const unavailable=()=>{
    if(failed||!current())return;
    failed=true;
    link.remove();
    onUnavailable(gallery);
  };
  image.addEventListener('error',async()=>{
    if(!current()||failed)return;
    if(retried){unavailable();return}
    retried=true;
    let result;
    try{result=await store.createSignedUrl(path,120)}
    catch{unavailable();return}
    if(!current()||failed)return;
    if(result?.error||typeof result?.data?.signedUrl!=='string'||
       !result.data.signedUrl){
      unavailable();
      return;
    }
    // Se renueva tanto la miniatura como el enlace al archivo original.
    // Una segunda respuesta de error finaliza el intento sin bucle.
    link.href=result.data.signedUrl;
    image.src=result.data.signedUrl;
  });
}
