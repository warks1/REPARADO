import test from 'node:test';
import assert from 'node:assert/strict';
import {createPushSessionManager} from '../push-session.js';

const tokenA='REPARADO_PUSH_DEVICE_TOKEN_A_1234567890123456789';
const tokenB='REPARADO_PUSH_DEVICE_TOKEN_B_1234567890123456789';

function mockNative(){
 const callbacks=new Map(),stored=new Map(),calls=[];
 let current='A',loseAck=false,failRevocation=false;
 const mock={
   Capacitor:{isNativePlatform:()=>true,getPlatform:()=>'android'},
   PushNotifications:{
     requestPermissions:async()=>({receive:'granted'}),
     addListener:async(name,fn)=>{
       callbacks.set(name,fn);
       return {remove:async()=>{if(callbacks.get(name)===fn)callbacks.delete(name)}};
     },
     register:async()=>{}
   },
   supabase:{rpc:async(name,args)=>{
     calls.push({name,token:args.p_token,user:current});
     if(name==='reparado_register_device'){
       stored.set(args.p_token,current);
       if(loseAck)return {data:null,error:new Error('Se perdió la respuesta')};
       return {data:true,error:null};
     }
     if(name==='reparado_revoke_device'){
       if(failRevocation)return {data:null,error:new Error('Sin red')};
       if(stored.get(args.p_token)===current){stored.delete(args.p_token);return {data:true,error:null}}
       return {data:false,error:null};
     }
     return {error:new Error('RPC inesperada')};
   }},
   setUser:id=>{current=id},
   loseAck:value=>{loseAck=value},
   failRevocation:value=>{failRevocation=value},
   issueToken:value=>callbacks.get('registration')?.({value}),
   callbacks,stored,calls
 };
 return mock;
}

test('V42: registro guardado en servidor con respuesta perdida se revoca antes de salir',async()=>{
 const d=mockNative(),errors=[];
 const p=createPushSessionManager({...d,onError:e=>errors.push(e.message)});
 d.setUser('A');
 assert.equal(await p.activate('A'),true);
 d.loseAck(true);
 await d.issueToken(tokenA);
 assert.equal(d.stored.get(tokenA),'A');
 assert.equal(errors.length,1);
 assert.equal(await p.deactivate('A'),true);
 assert.equal(d.stored.size,0);
 assert.deepEqual(d.calls.map(x=>x.name),['reparado_register_device','reparado_revoke_device']);
 d.setUser('B');
 assert.equal(await p.activate('B'),true);
 await d.issueToken(tokenA);
 assert.equal(await p.deactivate('B'),true);
 assert.equal(d.stored.size,0);
});

test('V42: si también falla la revocación se rechaza la salida y se conserva el token para reintentar',async()=>{
 const d=mockNative(),p=createPushSessionManager({...d,onError:()=>{}});
 d.setUser('A');await p.activate('A');
 d.loseAck(true);await d.issueToken(tokenA);
 d.failRevocation(true);
 assert.equal(await p.deactivate('A'),false);
 assert.equal(d.stored.get(tokenA),'A');
 d.setUser('B');
 assert.equal(await p.activate('B'),false);
 assert.equal(d.calls.filter(x=>x.name==='reparado_register_device').length,1);
 d.setUser('A');d.failRevocation(false);
 assert.equal(await p.deactivate('A'),true);
 d.setUser('B');
 assert.equal(await p.activate('B'),true);
 assert.equal(await p.deactivate('B'),true);
 assert.equal(d.stored.size,0);
});

test('V42: rechaza reemplazar cuenta con token activo incluso sin logout previo',async()=>{
 const d=mockNative(),p=createPushSessionManager(d);
 await p.activate('A');await d.issueToken(tokenA);
 assert.equal(d.stored.get(tokenA),'A');
 d.setUser('B');
 assert.equal(await p.activate('B'),false);
 assert.equal(d.calls.filter(x=>x.name==='reparado_register_device').length,1);
 d.setUser('A');
 assert.equal(await p.deactivate('A'),true);
 d.setUser('B');
 assert.equal(await p.activate('B'),true);
 await d.issueToken(tokenB);
 assert.equal(d.stored.get(tokenB),'B');
 await p.deactivate('B');
 assert.equal(d.stored.size,0);
});

test('V42: error ambiguo en rotación revoca tanto el token antiguo como el nuevo',async()=>{
 const d=mockNative(),p=createPushSessionManager({...d,onError:()=>{}});
 d.setUser('A');await p.activate('A');
 await d.issueToken(tokenA);
 d.loseAck(true);await d.issueToken(tokenB);
 assert.equal(d.stored.size,2);
 assert.equal(await p.deactivate('A'),true);
 assert.equal(d.stored.size,0);
 const revoked=d.calls.filter(x=>x.name==='reparado_revoke_device').map(x=>x.token);
 assert.deepEqual(new Set(revoked),new Set([tokenA,tokenB]));
});
