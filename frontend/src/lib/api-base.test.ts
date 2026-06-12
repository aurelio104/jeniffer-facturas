import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBase } from './api-base.ts';

test('resolveApiBase sin window devuelve /api por defecto', () => {
  assert.equal(resolveApiBase(), '/api');
});
