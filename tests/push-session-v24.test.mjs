import test from 'node:test';
import assert from 'node:assert/strict';
import {createPushSessionManager} from '../push-session.js';

function fakeDevice(){
  const listeners=new Map(), calls=[], tokens=new Map();
  let currentUser=null, failRevoke=false, failRegister=false;
  const api={
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
      calls.push({name,args,user:currentUser});
      if(name==='reparado_register_device'){
        if(failRegister)return {error:new Error('not installed')};
        tokens.set(args.p_token,currentUser);
        return {data:true,error:null};
      }
      if(name==='reparado_revoke_device'){
        if(failRevoke)return {error:new Error('offline')};
        if(tokens.get(args.p_token)===currentUser)tokens.delete(args.p_token);
        return {data:true,error:null};
      }
      return {error:new Error('unknown rpc')};
    }},
    emit:async(name,data)=>listeners.get(name)?.(data),
    setUser:id=>{currentUser=id},
    revokeFails:value=>{failRevoke=value},
    registerFails:value=>{failRegister=value},
    tokens,calls,listeners
  };
  return api;
}
const token='device_token_example_with_at_least_thirty_two_chars';
test('móvil: logout espera registro en vuelo y revoca el token del usuario anterior',async()=>{
  const device=fakeDevice();
  const manager=createPushSessionManager(device);
  device.setUser('A');
  assert.equal(await manager.activate('A'),true);
  const sending=device.emit('registration',{value:token});
  const leaving=manager.deactivate('A');
  await sending;assert.equal(await leaving,true);
  assert.equal(device.tokens.size,0);
  device.setUser('B');
  assert.equal(await manager.activate('B'),true);
  await device.emit('registration',{value:token});
  assert.equal(await manager.deactivate('B'),true);
  assert.equal(device.tokens.size,0);
  assert.equal(device.calls.filter(call=>call.name==='reparado_revoke_device').length,2);
});
test('móvil: no permite cambiar de cuenta si no pudo revocar el registro',async()=>{
  const device=fakeDevice();const manager=createPushSessionManager(device);
  device.setUser('A');
  await manager.activate('A');await device.emit('registration',{value:token});
  device.revokeFails(true);
  assert.equal(await manager.deactivate('A'),false);
  assert.equal(device.tokens.get(token),'A');
  device.revokeFails(false);
  assert.equal(await manager.deactivate('A'),true);
  assert.equal(device.tokens.size,0);
});
test('móvil: desconectar listeners antiguos evita dobles registros',async()=>{
  const d=fakeDevice(); const p=createPushSessionManager(d);
  d.setUser('A');await p.activate('A');await d.emit('registration',{value:token});
  await p.deactivate('A');
  assert.equal(d.listeners.size,0);
  d.setUser('B');await p.activate('B');await d.emit('registration',{value:token});
  // La RPC de registro es asíncrona; la baja espera a que termine.
  await p.deactivate('B');
  assert.equal(d.calls.filter(x=>x.name==='reparado_register_device').length,2);
});
test('móvil: nunca registra tokens si Supabase rechaza la RPC',async()=>{
  const d=fakeDevice();const errors=[];d.registerFails(true);
  const p=createPushSessionManager({...d,onError:e=>errors.push(String(e))});
  d.setUser('A');await p.activate('A');await d.emit('registration',{value:token});
  await p.deactivate('A');
  assert.equal(errors.length,1);
  assert.equal(d.tokens.size,0);
});

test('móvil: cerrar sesión durante el permiso impide registro tardío',async()=>{
  const d=fakeDevice();
  let allow;
  d.PushNotifications.requestPermissions=()=>new Promise(resolve=>{allow=resolve});
  const manager=createPushSessionManager(d);
  d.setUser('A');
  const activating=manager.activate('A');
  // Esperar un microturno a que la API de permisos sea consultada.
  await Promise.resolve();
  await Promise.resolve();
  const leaving=manager.deactivate('A');
  allow({receive:'granted'});
  assert.equal(await activating,false);
  assert.equal(await leaving,true);
  assert.equal(d.listeners.size,0);
  assert.equal(d.calls.length,0);
});

test('V28: si Android renueva su token se retira el anterior y solo permanece el último',async()=>{
  const d=fakeDevice();
  const manager=createPushSessionManager(d);
  const second='new_device_token_example_with_at_least_thirty_two_chars';
  d.setUser('A');
  assert.equal(await manager.activate('A'),true);
  await d.emit('registration',{value:token});
  await d.emit('registration',{value:second});
  assert.equal(await manager.deactivate('A'),true);
  assert.equal(d.tokens.size,0);
  const registrations=d.calls.filter(x=>x.name==='reparado_register_device').map(x=>x.args.p_token);
  const revocations=d.calls.filter(x=>x.name==='reparado_revoke_device').map(x=>x.args.p_token);
  assert.deepEqual(registrations,[token,second]);
  assert.deepEqual(revocations,[token,second]);
});
test('V28: error al revocar token antiguo bloquea salida hasta limpiar ambos tokens',async()=>{
  const d=fakeDevice();const errors=[];
  const manager=createPushSessionManager({...d,onError:e=>errors.push(String(e))});
  const second='second_device_token_example_with_at_least_thirty_two_chars';
  d.setUser('A');await manager.activate('A');
  await d.emit('registration',{value:token});
  d.revokeFails(true);
  await d.emit('registration',{value:second});
  assert.equal(await manager.deactivate('A'),false);
  assert.equal(d.tokens.size,2);
  d.revokeFails(false);
  assert.equal(await manager.deactivate('A'),true);
  assert.equal(d.tokens.size,0);
  assert.ok(errors.length>=1);
});
test('V28: registrar varias veces el mismo token no inventa una revocación adicional',async()=>{
  const d=fakeDevice(),p=createPushSessionManager(d);
  d.setUser('A');await p.activate('A');
  await d.emit('registration',{value:token});
  await d.emit('registration',{value:token});
  await p.deactivate('A');
  assert.deepEqual(d.calls.filter(x=>x.name==='reparado_revoke_device').map(x=>x.args.p_token),[token]);
});
