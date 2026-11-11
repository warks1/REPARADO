import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workNotesDirty,confirmWorkNotesExit,WORK_NOTES_EXIT_WARNING}
  from '../work-notes-draft.js';

test('V109: distingue texto pendiente de parte guardado confirmado',()=>{
  assert.equal(workNotesDirty('',null),false);
  assert.equal(workNotesDirty('   ',''),false);
  assert.equal(workNotesDirty('Trabajo guardado','Trabajo guardado'),false);
  assert.equal(workNotesDirty('  Trabajo guardado  ','Trabajo guardado'),false);
  assert.equal(workNotesDirty('Trabajo modificado','Trabajo guardado'),true);
  assert.equal(workNotesDirty('Trabajo escrito',''),true);
  assert.equal(workNotesDirty('', 'Trabajo guardado'),true);
});

test('V109: salir sin cambios no abre diálogos',()=>{
  let calls=0;
  assert.equal(confirmWorkNotesExit({
    draft:'Reparación confirmada',confirmed:'Reparación confirmada',
    confirmExit:()=>{calls++;return false}
  }),true);
  assert.equal(calls,0);
});

test('V109: rechazar la salida protege las notas no guardadas',()=>{
  const prompts=[];
  const params={draft:'Texto nuevo',confirmed:'Texto anterior',
    confirmExit:message=>{prompts.push(message);return false}};
  assert.equal(confirmWorkNotesExit(params),false);
  assert.deepEqual(prompts,[WORK_NOTES_EXIT_WARNING]);
  assert.match(WORK_NOTES_EXIT_WARNING,/se perderán/);
  assert.equal(confirmWorkNotesExit({...params,confirmExit:()=>true}),true);
  // Sin mecanismo de confirmación no se permite abandonar un parte modificado.
  assert.equal(confirmWorkNotesExit({...params,confirmExit:null}),false);
});

test('V109: indicador, confirmación y preservación de borrador integrados',()=>{
  const src=readFileSync(new URL('../operator-work-view.js',import.meta.url),'utf8');
  assert.match(src,/data-work-draft-state/);
  assert.match(src,/notes\?\.addEventListener\('input',updateDraftIndicator\)/);
  assert.match(src,/workNotesDirty\(notes.value,confirmedNotes\)/);
  assert.match(src,/confirmWorkNotesExit\(\{/);
  assert.match(src,/confirmExit:message=>window\.confirm\(message\)/);
  assert.ok(src.includes("const currentText=retain?(notes?.value??null):null;"));
  assert.match(src,/if\(busy\|\|!active\(\)\)return/);
});
