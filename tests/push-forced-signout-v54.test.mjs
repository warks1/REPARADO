import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPushSessionManager} from '../push-session.js';

const oldToken='REPARADO_V54_DEVICE_OLD_TOKEN_1234567890';
const freshToken='REPARADO_V54_DEVICE_FRESH_TOKEN_1234567890';

function mockMobile(){
  const listeners=new Map(), tokens=new Map(), calls=[];
  let account='A', revokeOffline=false;
  return {
    Capacitor:{isNativePlatform:()=>true,getPlatform:()=>'android'},
    PushNotifications:{
      requestPermissions:async()=>({receive:'granted'}),
      addListener:async(name,fn)=>{
        listeners.set(name,fn);
        return {remove:async()=>{if(listeners.get(name)===fn)listeners.delete(name)}};
      },
      register:async()=>{}
    },
    supabase:{rpc:async(name,args)=>{
      calls.push({name,account,token:args.p_token});
      if(name==='reparado_register_device'){
        tokens.set(args.p_token,account);
        return {data:true,error:null};
      }
      if(name==='reparado_revoke_device'){
        if(revokeOffline)return {data:null,error:new Error('offline')};
        const owned=tokens.get(args.p_token)===account;
        if(owned)tokens.delete(args.p_token);
        return {data:owned,error:null};
      }
      return {error:new Error('RPC inesperada')};
    }},
    setAccount:id=>{account=id},
    setRevokeOffline:value=>{revokeOffline=value},
    async sendToken(value){
      listeners.get('registration')?.({value});
      await new Promise(resolve=>setImmediate(resolve));
    },
    listeners,tokens,calls
  };
}

test('V54: SIGNED_OUT inesperado no descarta token antiguo ni permite registrar cuenta B',async()=>{
  const mobile=mockMobile(),manager=createPushSessionManager(mobile);
  assert.equal(await manager.activate('A'),true);
  await mobile.sendToken(oldToken);
  assert.equal(mobile.tokens.get(oldToken),'A');
  await manager.suspend();
  assert.equal(mobile.listeners.size,0);
  mobile.setAccount('B');
  assert.equal(await manager.activate('B'),false);
  await mobile.sendToken(freshToken);
  assert.equal(mobile.tokens.get(oldToken),'A');
  assert.equal(mobile.tokens.has(freshToken),false);
  assert.equal(mobile.calls.filter(x=>x.name==='reparado_register_device').length,1);
  mobile.setAccount('A');
  assert.equal(await manager.activate('A'),true);
  assert.equal(mobile.tokens.has(oldToken),false,'A limpia su token anterior antes de registrar de nuevo');
  await mobile.sendToken(freshToken);
  assert.equal(mobile.tokens.get(freshToken),'A');
  assert.equal(await manager.deactivate('A'),true);
  assert.equal(mobile.tokens.size,0);
  mobile.setAccount('B');
  assert.equal(await manager.activate('B'),true);
  await mobile.sendToken(oldToken);
  assert.equal(mobile.tokens.get(oldToken),'B');
  assert.equal(await manager.deactivate('B'),true);
});

test('V54: fallo de revocación después del cierre externo mantiene bloqueo entre cuentas',async()=>{
  const mobile=mockMobile(),errors=[];
  const manager=createPushSessionManager({...mobile,onError:error=>errors.push(error.message)});
  await manager.activate('A');
  await mobile.sendToken(oldToken);
  await manager.suspend();
  mobile.setRevokeOffline(true);
  assert.equal(await manager.activate('A'),false,'no se emite nuevo registro tras fallo de baja');
  mobile.setAccount('B');
  assert.equal(await manager.activate('B'),false);
  assert.equal(mobile.tokens.get(oldToken),'A');
  mobile.setAccount('A');
  mobile.setRevokeOffline(false);
  assert.equal(await manager.activate('A'),true);
  assert.equal(mobile.tokens.size,0);
  assert.ok(errors.length>0);
  assert.equal(await manager.deactivate('A'),true);
});

test('V54: cierre durante permisos pendientes invalida el registro tardío',async()=>{
  const mobile=mockMobile();
  let finishPermission;
  mobile.PushNotifications.requestPermissions=()=>new Promise(resolve=>{finishPermission=resolve});
  const manager=createPushSessionManager(mobile);
  const activation=manager.activate('A');
  await Promise.resolve();
  await Promise.resolve();
  await manager.suspend();
  finishPermission({receive:'granted'});
  assert.equal(await activation,false);
  assert.equal(mobile.listeners.size,0);
  mobile.setAccount('B');
  assert.equal(await manager.activate('B'),false);
  assert.equal(mobile.calls.length,0);
});

test('V54: la aplicación suspende la asociación push al recibir SIGNED_OUT',()=>{
  const source=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
  assert.match(source,/if\(event==='SIGNED_OUT'\)\{[\s\S]{0,100}pushManager\.suspend\(\)/);
  assert.doesNotMatch(source,/pushManager\.discard\(/);
});

test('V54: fallo de registro nativo tras aceptar el token conserva baja pendiente',async()=>{
  const mobile=mockMobile(),errors=[];
  mobile.PushNotifications.register=async()=>{
    await mobile.sendToken(oldToken);
    throw new Error('error nativo tras enviar el token');
  };
  const manager=createPushSessionManager({...mobile,onError:error=>errors.push(error.message)});
  assert.equal(await manager.activate('A'),false);
  assert.equal(mobile.tokens.get(oldToken),'A');
  assert.equal(mobile.listeners.size,0);
  mobile.setAccount('B');
  assert.equal(await manager.activate('B'),false,'no transferir registros inciertos a B');
  mobile.setAccount('A');
  mobile.PushNotifications.register=async()=>{};
  assert.equal(await manager.activate('A'),true);
  assert.equal(mobile.tokens.has(oldToken),false);
  assert.ok(errors.length);
  assert.equal(await manager.deactivate('A'),true);
});

test('V54: B puede cerrar su sesión sin push y la revocación pendiente de A permanece',async()=>{
  const mobile=mockMobile(),manager=createPushSessionManager(mobile);
  await manager.activate('A');
  await mobile.sendToken(oldToken);
  await manager.suspend();
  mobile.setAccount('B');
  assert.equal(await manager.activate('B'),false);
  assert.equal(await manager.deactivate('B'),true,'B no creó token y debe poder salir');
  await manager.suspend(); // callback SIGNED_OUT de B
  assert.equal(mobile.tokens.get(oldToken),'A');
  mobile.setAccount('A');
  assert.equal(await manager.activate('A'),true);
  assert.equal(mobile.tokens.size,0);
  await manager.deactivate('A');
});
