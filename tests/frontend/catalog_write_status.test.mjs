// Catálogos · aviso de guardado no habilitado (src/views/catalog/writeStatus.mjs). Lógica pura; node --test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeStatusNotice, writeConfigErrorText, loadWriteStatus, resetWriteStatusCache, WRITE_BLOCKING_CODES, WRITE_STATUS_URL, WRITE_TABLES } from '../../src/views/catalog/writeStatus.mjs';

const CLI = { es: 'clientes', en: 'clients' };

test('sin aviso cuando el guardado está habilitado o el estado es desconocido', () => {
  assert.equal(writeStatusNotice({ enabled: true, code: 'OK' }, CLI), null);
  assert.equal(writeStatusNotice(null, CLI), null);
  assert.equal(writeStatusNotice(undefined, CLI), null);
});

test('API iniciada sin el overlay: explica la causa y quién lo resuelve', () => {
  const n = writeStatusNotice({ enabled: false, code: 'CATALOG_WRITE_NOT_PROVISIONED', missing_grants: [], expected_grants: 33 }, CLI);
  assert.equal(n.title, 'El guardado de clientes no está habilitado en este equipo');
  assert.match(n.text, /compose\.supply-catalogwrite\.yml/);
  assert.match(n.text, /no se guardarán en MariaDB/);
  assert.match(n.action, /Activación en la PC.*docs\/clientes\/ALTA_EDICION_CLIENTES\.md.*autorización/);
});

test('cuenta rechazada por MariaDB: no existe o la contraseña no coincide', () => {
  const n = writeStatusNotice({ enabled: false, code: 'CATALOG_WRITE_ACCOUNT_REJECTED' }, { es: 'proveedores', en: 'suppliers' });
  assert.equal(n.title, 'MariaDB rechazó la cuenta de escritura del catálogo');
  assert.match(n.text, /supplyflow_catalogwrite_local no existe .* contraseña no coincide/);
  assert.match(n.text, /Los cambios de proveedores no se guardarán/);
  assert.match(n.action, /provision y verify/);
});

test('permisos incompletos: cuántos faltan y cuáles (máximo 4 en el texto)', () => {
  const n = writeStatusNotice({ enabled: false, code: 'CATALOG_WRITE_GRANTS_INCOMPLETE', expected_grants: 33, missing_grants: ['INSERT clients', 'UPDATE clients'] }, CLI);
  assert.match(n.text, /^Faltan 2 de 33 permisos \(INSERT clients, UPDATE clients\)\. Algunos guardados de clientes fallarán\.$/);
  const many = writeStatusNotice({ enabled: false, code: 'CATALOG_WRITE_GRANTS_INCOMPLETE', expected_grants: 33, missing_grants: ['A', 'B', 'C', 'D', 'E'] }, CLI);
  assert.match(many.text, /\(A, B, C, D…\)/);
  assert.match(n.action, /volver a ejecutar provision/);
});

test('otro error: aviso neutro sin acción', () => {
  const n = writeStatusNotice({ enabled: false, code: 'CATALOG_WRITE_UNAVAILABLE' }, CLI);
  assert.equal(n.title, 'No se pudo comprobar el guardado de clientes');
  assert.equal(n.action, '');
});

test('inglés', () => {
  assert.equal(writeStatusNotice({ enabled: false, code: 'CATALOG_WRITE_NOT_PROVISIONED' }, CLI, true).title, 'Saving clients is not enabled on this computer');
});

test('mensaje al guardar para los códigos de configuración; null para el resto', () => {
  assert.deepEqual(WRITE_BLOCKING_CODES, ['CATALOG_WRITE_NOT_PROVISIONED', 'CATALOG_WRITE_ACCOUNT_REJECTED', 'CATALOG_WRITE_GRANTS_INCOMPLETE']);
  assert.match(writeConfigErrorText('CATALOG_WRITE_NOT_PROVISIONED', CLI), /^El guardado de clientes no está habilitado en este equipo\. No se guardó nada\. Para habilitarlo/);
  assert.match(writeConfigErrorText('CATALOG_WRITE_ACCOUNT_REJECTED', CLI), /^MariaDB rechazó la cuenta de escritura del catálogo\. No se guardó nada\. El administrador debe ejecutar provision y verify/);
  assert.match(writeConfigErrorText('CATALOG_WRITE_GRANTS_INCOMPLETE', CLI), /^A la cuenta de escritura del catálogo le faltan permisos en MariaDB\. No se guardó nada\. El administrador debe volver a ejecutar provision/);
  for (const c of ['CATALOG_WRITE_UNAVAILABLE', 'CLIENT_WRITE_UNAVAILABLE', 'CODE_TAKEN', undefined]) assert.equal(writeConfigErrorText(c, CLI), null);
});

test('loadWriteStatus: una consulta por minuto; 401/403 o red caída → sin aviso', async () => {
  resetWriteStatusCache();
  const calls = [];
  const ok = (url, opts) => { calls.push([url, opts]); return Promise.resolve({ ok: true, json: () => Promise.resolve({ enabled: true, code: 'OK' }) }); };
  assert.deepEqual(await loadWriteStatus(ok, 1000), { enabled: true, code: 'OK' });
  await loadWriteStatus(ok, 30000);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], WRITE_STATUS_URL);
  assert.equal(calls[0][1].cache, 'no-store');
  await loadWriteStatus(ok, 62000);
  assert.equal(calls.length, 2);
  resetWriteStatusCache();
  assert.equal(await loadWriteStatus(() => Promise.resolve({ ok: false, status: 403 }), 1), null);
  resetWriteStatusCache();
  assert.equal(await loadWriteStatus(() => Promise.reject(new Error('red')), 1), null);
  resetWriteStatusCache();
});

test('permisos incompletos: cada pantalla solo avisa de los de sus propias tablas', () => {
  const st = { enabled: false, code: 'CATALOG_WRITE_GRANTS_INCOMPLETE', expected_grants: 35, missing_grants: ['SELECT organizations', 'UPDATE organizations'] };
  for (const k of ['clients', 'suppliers', 'supplies', 'categories']) assert.equal(writeStatusNotice(st, { es: k, en: k, tables: WRITE_TABLES[k] }), null, k);
  const n = writeStatusNotice(st, { es: 'los datos de la empresa', en: 'company data', tables: WRITE_TABLES.company });
  assert.match(n.text, /^Faltan 2 de 35 permisos \(SELECT organizations, UPDATE organizations\)/);
  assert.match(n.action, /docs\/clientes\/ALTA_EDICION_CLIENTES\.md/);
  assert.match(writeStatusNotice(st, { es: 'x', en: 'x', tables: WRITE_TABLES.company, guide: 'docs/contratista/DATOS_EMPRESA.md' }).action, /docs\/contratista\/DATOS_EMPRESA\.md/);
  assert.match(writeConfigErrorText('CATALOG_WRITE_GRANTS_INCOMPLETE', { es: 'x', en: 'x', guide: 'docs/contratista/DATOS_EMPRESA.md' }), /docs\/contratista\/DATOS_EMPRESA\.md/);
  const mixed = { ...st, missing_grants: ['INSERT clients', 'UPDATE organizations'] };
  assert.match(writeStatusNotice(mixed, { es: 'clientes', en: 'clients', tables: WRITE_TABLES.clients }).text, /^Faltan 1 de 35 permisos \(INSERT clients\)/);
  assert.notEqual(writeStatusNotice({ enabled: false, code: 'CATALOG_WRITE_NOT_PROVISIONED' }, { es: 'clientes', en: 'clients', tables: WRITE_TABLES.clients }), null);
});
