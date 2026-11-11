import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workNotesDirty,confirmWorkNotesExit}
  from '../work-notes-draft.js';

const connected=readFileSync(new URL('../connected.js',import.meta.url),'utf8');
const workView=readFileSync(new URL('../operator-work-view.js',import.meta.url),'utf8');

test('V111: el menú general intercepta rutas antes de la navegación anterior',()=>{
  const guard=connected.indexOf("app.addEventListener('click',event=>{");
  const route=connected.indexOf("app.addEventListener('click', event => {");
  assert.ok(guard!==-1&&route!==-1&&guard<route,
    'El interceptor debe registrarse antes de los botones globales');
  assert.match(connected,/currentView!=='operator-work'\|\|!operatorWorkNavigationGuard/);
  assert.match(connected,/event\.stopImmediatePropagation\(\)/);
  for(const target of ['data-view','data-service','data-logout']){
    assert.ok(connected.slice(guard,route).includes(target),target);
  }
  assert.ok(connected.slice(guard,route).includes('},true)'),
    'Debe usar la fase de captura para detener navegación prematura');
});

test('V111: una salida forzada de Supabase no queda bloqueada por el borrador',()=>{
  assert.match(connected,/supabase\.auth\.onAuthStateChange/);
  assert.match(connected,/if\(event==='SIGNED_OUT'\)/);
  assert.match(connected,/if\(currentView==='operator-work'&&operatorWorkNavigationGuard\?\.hasUnsaved\(\)\)/);
  assert.match(connected,/window\.addEventListener\('beforeunload'/);
  assert.doesNotMatch(connected,/localStorage\.setItem\(['"]work_report/);
});

test('V111: estado de notas confirmado por servidor, revalidado al renderizar',()=>{
  assert.match(workView,/onNavigationGuard\?\.\(\{/);
  assert.match(workView,/canLeave:requestLeave/);
  assert.match(workView,/hasUnsaved:.*\(\)=>active\(\)\&\&screen\.isConnected/);
  assert.match(workView,/workNotesDirty\(notes\?\.value,confirmedNotes\)/);
  assert.match(workView,/if\(busy\)return false/);
  assert.match(workView,/if\(!requestLeave\(\)\)return/);
  assert.match(connected,/operatorWorkNavigationGuard=null;\s*currentView='operator-work'/);
});

test('V111: navegaciones aceptadas conservan controles V109 de texto',()=>{
  assert.equal(workNotesDirty('Cambio temporal','Confirmado'),true);
  assert.equal(confirmWorkNotesExit({
    draft:'Cambio temporal',confirmed:'Confirmado',confirmExit:()=>false
  }),false);
  assert.equal(confirmWorkNotesExit({
    draft:'Cambio temporal',confirmed:'Confirmado',confirmExit:()=>true
  }),true);
  assert.equal(confirmWorkNotesExit({
    draft:'Confirmado',confirmed:'Confirmado',confirmExit:()=>{throw Error('No preguntar')}
  }),true);
});
