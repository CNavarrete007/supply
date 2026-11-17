// Usuarios y roles · tarjeta 4 "Resumen de acceso": filtros por indicador y recomendaciones (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSummary, applyKpiFilter, KPI_LABELS, staleAccounts, adminLevel } from '../../src/views/usersRoles/model.mjs';

const NOW = new Date('2026-11-17T12:00:00Z');
const U = [
  { id: 'a', status: 'active', access_enabled: true, credential_state: 'local_validated', role_codes: ['master_admin'], last_login_at: '2026-11-16 10:00:00.000000' },
  { id: 'b', status: 'active', access_enabled: true, credential_state: 'local_validated', role_codes: ['buyer'], last_login_at: '2026-05-01 10:00:00' },
  { id: 'c', status: 'active', access_enabled: false, role_codes: [] },
  { id: 'd', status: 'blocked', access_enabled: true, credential_state: 'local_validated', role_codes: ['buyer'] },
  { id: 'e', status: 'inactive', access_enabled: true, credential_state: 'reset_required', role_codes: [] },
];
const FN = new Map([['b', { po_buyer: 2, po_preparer: 1 }], ['a', { po_authorizer: 3 }]]);

test('indicadores: inactivos / bloqueados por estatus; sin acceso aparte', () => {
  const s = accessSummary(U, FN);
  assert.equal(s.people, 5); assert.equal(s.withAccess, 2); assert.equal(s.inactiveBlocked, 2); assert.equal(s.noAccess, 1);
  assert.equal(s.buyers, 1); assert.equal(s.preparers, 1); assert.equal(s.authorizers, 1);
});

test('filtro exacto de cada indicador en la matriz (mismos conteos)', () => {
  const s = accessSummary(U, FN);
  assert.deepEqual(applyKpiFilter(U, 'access', FN).map(u => u.id), ['a', 'b']);
  assert.deepEqual(applyKpiFilter(U, 'buyer', FN).map(u => u.id), ['b']);
  assert.deepEqual(applyKpiFilter(U, 'preparer', FN).map(u => u.id), ['b']);
  assert.deepEqual(applyKpiFilter(U, 'authorizer', FN).map(u => u.id), ['a']);
  assert.deepEqual(applyKpiFilter(U, 'inactive', FN).map(u => u.id), ['d', 'e']);
  assert.equal(applyKpiFilter(U, '', FN).length, 5);
  for (const [k, f] of [['access', 'withAccess'], ['buyer', 'buyers'], ['preparer', 'preparers'], ['authorizer', 'authorizers'], ['inactive', 'inactiveBlocked']]) assert.equal(applyKpiFilter(U, k, FN).length, s[f], k);
  assert.equal(KPI_LABELS.inactive[0], 'Inactivos / bloqueados');
});

test('recomendaciones: cuentas sin uso en 90 días y nivel de administradores', () => {
  assert.deepEqual(staleAccounts(U, NOW).map(u => u.id), ['b']);
  assert.deepEqual(staleAccounts([{ ...U[0], last_login_at: null }], NOW).map(u => u.id), ['a'], 'con acceso y nunca ha iniciado sesión');
  assert.deepEqual([adminLevel(0), adminLevel(1), adminLevel(2), adminLevel(5)], ['danger', 'warn', 'ok', 'ok']);
});
