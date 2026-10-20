import test from 'node:test';
import assert from 'node:assert/strict';
import { operatorMaySetStatus } from '../rules.js';

test('un operario puede iniciar y finalizar su trabajo', () => {
  assert.equal(operatorMaySetStatus('scheduled','in_progress'),true);
  assert.equal(operatorMaySetStatus('in_progress','completed'),true);
});
test('un operario no acepta presupuestos ni asigna estados administrativos', () => {
  assert.equal(operatorMaySetStatus('quoted','accepted'),false);
  assert.equal(operatorMaySetStatus('new','scheduled'),false);
  assert.equal(operatorMaySetStatus('completed','scheduled'),false);
  assert.equal(operatorMaySetStatus('in_progress','scheduled'),false);
});
test('guardar el mismo estado no supone una transición', () => {
  assert.equal(operatorMaySetStatus('scheduled','scheduled'),true);
  assert.equal(operatorMaySetStatus(null,'completed'),false);
  assert.equal(operatorMaySetStatus('scheduled',null),false);
});
