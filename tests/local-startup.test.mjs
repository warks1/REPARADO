import test from 'node:test';
import assert from 'node:assert/strict';
import { mountLocal } from '../local-preview.js';

test('el módulo de cliente local se puede importar sin errores de sintaxis',()=>{
  assert.equal(typeof mountLocal,'function');
});
