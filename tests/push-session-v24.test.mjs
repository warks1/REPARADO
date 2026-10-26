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
