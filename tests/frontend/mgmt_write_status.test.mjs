// Gestión del Contratista · aviso de guardado no habilitado (src/views/contractorMgmt/writeStatus.mjs). Lógica pura; node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mgmtNotice, mgmtConfigErrorText, MGMT_BLOCKING_CODES, MGMT_GUIDE } from '../../src/views/contractorMgmt/writeStatus.mjs';

test('sin aviso cuando el guardado está habilitado o el estado es desconocido', () => {
  assert.equal(mgmtNotice({ enabled: true, code: 'OK' }), null);
  assert.equal(mgmtNotice(null), null);
});

test('cuenta sin aprovisionar, rechazada o con permisos incompletos: causa y guía', () => {
  const n = mgmtNotice({ enabled: false, code: 'MGMT_WRITE_NOT_PROVISIONED' });
  assert.equal(n.title, 'El guardado de Gestión del Contratista no está habilitado en este equipo');
  assert.match(n.text, /compose\.supply-mgmtwrite\.yml/);
  assert.ok(n.action.includes(MGMT_GUIDE));
  assert.match(mgmtNotice({ enabled: false, code: 'MGMT_WRITE_ACCOUNT_REJECTED' }).text, /supplyflow_mgmtwrite_local no existe/);
  const g = mgmtNotice({ enabled: false, code: 'MGMT_WRITE_GRANTS_INCOMPLETE', expected_grants: 33, missing_grants: ['INSERT sourcing_plans', 'UPDATE(notes) requisition_reviews'] });
  assert.match(g.text, /^Faltan 2 de 33 permisos \(INSERT sourcing_plans, UPDATE\(notes\) requisition_reviews\)/);
  assert.equal(mgmtNotice({ enabled: false, code: 'MGMT_WRITE_UNAVAILABLE' }).action, '');
});

test('mensaje al guardar solo para códigos de configuración', () => {
  assert.deepEqual(MGMT_BLOCKING_CODES, ['MGMT_WRITE_NOT_PROVISIONED', 'MGMT_WRITE_ACCOUNT_REJECTED', 'MGMT_WRITE_GRANTS_INCOMPLETE']);
  assert.match(mgmtConfigErrorText('MGMT_WRITE_NOT_PROVISIONED'), /no está habilitado en este equipo\. No se guardó nada\./);
  for (const c of ['MGMT_WRITE_UNAVAILABLE', 'INVALID_VALIDATION', undefined]) assert.equal(mgmtConfigErrorText(c), null);
});
