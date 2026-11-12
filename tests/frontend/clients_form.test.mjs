// Clientes · formulario de alta/actualización (lógica pura). Uso: node --test tests/frontend/clients_form.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { SALES_POLICIES, SOURCING_POLICIES, policyCode, policyLabel, emptyForm, formFromRecord, validateForm, toPayload, serverField, saveErrorMessage } from '../../src/views/clients/form.mjs';

test('opciones del diseño y códigos de ≤ 32 caracteres', () => {
  assert.deepEqual(SALES_POLICIES.map(o => o[1]), ['Precio sujeto a nueva cotización', 'Precio al cliente garantizado', 'Mixta / por partida', 'Contrato / Price List / Rate Card', 'Revisión manual']);
  assert.deepEqual(SOURCING_POLICIES.map(o => o[1]), ['Recotizar proveedores siempre', 'Validar costo/proveedor histórico', 'Reutilizar proveedor/costo si está vigente']);
  assert.ok([...SALES_POLICIES, ...SOURCING_POLICIES].every(o => o[0].length <= 32));
  assert.equal(policyCode('PRECIO SUJETO A NUEVA COTIZACION', SALES_POLICIES), 'quote_required', 'etiqueta histórica → código');
  assert.equal(policyCode('reuse_if_valid', SOURCING_POLICIES), 'reuse_if_valid');
  assert.equal(policyCode('valor_raro', SALES_POLICIES), 'valor_raro'); assert.equal(policyCode(null, SALES_POLICIES), '');
  assert.equal(policyLabel('mixed', SALES_POLICIES, true), 'Mixed / per item');
});

test('ficha → formulario conserva datos importados (varios teléfonos, valor histórico de política)', () => {
  const f = formFromRecord({ id: 'x', version: 4, imported: true, code: 'C1', name: 'Cliente', project: 'P', contract_reference: 'K', status: 'blocked', portal_enabled: true,
    contacts: [{ name: 'Ana' }], channels: [{ type: 'phone', value: '111' }, { type: 'phone', value: '222' }, { type: 'email', value: 'a@b.mx' }],
    repeat_policy: { sales_policy: 'Precio sujeto a nueva cotización', sourcing_policy: 'legacy_x', price_validity_days: 0, contract_valid_until: '2027-01-31', min_margin_pct: '12.500000' }, logo: { mime: 'image/png' } });
  assert.equal(f.version, 4); assert.equal(f.phone, '111 / 222'); assert.deepEqual(f.contacts, ['Ana', '']); assert.deepEqual(f.emails, ['a@b.mx', '']);
  assert.equal(f.policy.sales, 'quote_required'); assert.equal(f.policy.sourcing, 'legacy_x'); assert.equal(f.legacy.sourcing, 'legacy_x'); assert.equal(f.legacy.sales, '');
  assert.equal(f.policy.days, '0'); assert.equal(f.policy.margin, '12.5'); assert.equal(f.status, 'blocked'); assert.deepEqual(f.logo.current, { mime: 'image/png' });
  assert.deepEqual(emptyForm().contacts, ['', '']); assert.equal(emptyForm().status, 'active');
});

test('validación previa (el servidor valida de nuevo)', () => {
  const e = validateForm(emptyForm()).errors;
  assert.deepEqual(Object.keys(e).sort(), ['code', 'contract_reference', 'name', 'project']);
  const f = { ...emptyForm(), code: 'CLI-001', name: 'X', project: 'P', contract_reference: 'K', phone: '833-1 / abc', emails: ['ok@x.mx', 'mal'], policy: { ...emptyForm().policy, days: '-1', margin: '101' } };
  assert.deepEqual(Object.keys(validateForm(f).errors).sort(), ['days', 'emails', 'margin', 'phone']);
  assert.equal(validateForm({ ...f, phone: '833-456-7890 / 81 1111 2222', emails: ['ok@x.mx', ''], policy: { ...f.policy, days: '0', margin: '15.5' } }).ok, true);
  assert.equal(validateForm({ ...emptyForm(), code: '<script>', name: 'X', project: 'P', contract_reference: 'K' }).errors.code !== undefined, true);
});

test('cuerpo JSON: sin filas vacías, sin portal y logotipo según acción', () => {
  const base = { ...emptyForm(), id: 'x', code: ' C1 ', name: 'N', project: 'P', contract_reference: 'K', contacts: ['Ana', ' '], emails: ['', 'a@b.mx'], policy: { sales: 'guaranteed', sourcing: '', days: '30', ref: ' RC ', until: '', margin: '' } };
  const p = toPayload(base);
  assert.equal(p.code, 'C1'); assert.deepEqual(p.contacts, ['Ana']); assert.deepEqual(p.emails, ['a@b.mx']);
  assert.deepEqual(p.repeat_policy, { sales_policy: 'guaranteed', sourcing_policy: '', price_validity_days: 30, contract_reference: 'RC', contract_valid_until: null, min_margin_pct: null });
  assert.equal(p.logo, null); assert.equal('portal_enabled' in p || 'portal_key' in p, false);
  assert.deepEqual(toPayload({ ...base, logo: { current: {}, next: null, remove: true } }).logo, { remove: true });
  assert.deepEqual(toPayload({ ...base, logo: { current: null, next: { dataUrl: 'data:image/webp;base64,AA', name: 'l.webp' }, remove: false } }).logo, { data: 'data:image/webp;base64,AA', name: 'l.webp' });
});

test('mensajes de error del guardado', () => {
  assert.equal(serverField('repeat_policy.min_margin_pct'), 'margin'); assert.equal(serverField('code'), 'code');
  assert.match(saveErrorMessage(409, 'CODE_TAKEN'), /ya está registrado/); assert.match(saveErrorMessage(412, 'STALE_VERSION'), /Otra persona/);
  assert.match(saveErrorMessage(503, 'CATALOG_WRITE_NOT_PROVISIONED'), /aprovisionar/); assert.match(saveErrorMessage(401, 'NOT_AUTHENTICATED'), /sesión/);
  assert.match(saveErrorMessage(500, 'X', true), /No partial changes/);
});
