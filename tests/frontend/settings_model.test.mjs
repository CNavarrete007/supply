// Configuración · pestañas 1 a 5: correspondencia de GET /api/v1/settings con los formularios del diseño, validación
// y resultado de "Guardar" (valida, NO guarda). Datos sintéticos (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { identityFrom, paramsFrom, approvalFrom, conditionsFrom, emailFrom, changedFields, changedConditions, validateIdentity, validateParams, validateApprovals,
  validateConditions, validateEmail, approvalWarnings, saveResult, statusTone, utcText, recipientLines, exportConfig, importCheck, RULE_YES, RULE_NO, MAX_CONDITIONS } from '../../src/views/settings/settingsModel.mjs';

const SETTINGS = {
  identity: { system_name: 'SUPPLYFLOW QA', slogan: 'COMPRAS QA', company: 'EMPRESA QA', document_language: 'es', client_document_language: 'en', supplier_document_language: 'es', logo: { configured: true, quarantined: false } },
  parameters: { currency: 'MXN', req_prefix: 'REQ', po_prefix: 'OC', alert_days: 3, min_quotes: 3, tax_pct: 16 },
  approvals: { enabled: true, currency: 'MXN', item_limit: 15000, total_limit: 35000.02, total_base: 'beforeTaxAfterDiscount', policy: { version_number: 2, currency: 'MXN', unit_price_limit: 15000, document_limit: 35000.02 } },
  conditions: [{ active: true, es: 'Precios en {CURRENCY}.', en: 'Prices in {CURRENCY}.' }, { active: false, es: 'Inactiva.', en: 'Inactive.' }],
  email: { internal_enabled: true, cc_buyer: true, cc_admin: false, client_enabled: false, req_created: false, process_updates: true, quote_client: true, delivery: false, invoice: false, sender_name: 'SupplyFlow QA', reply_to: '', client_language: 'document', max_recipients: 15 },
  currencies: [{ code: 'MXN', name: 'Peso mexicano' }, { code: 'USD', name: 'Dólar' }],
};
const CUR = SETTINGS.currencies;

test('los formularios se llenan con lo leído de MariaDB (sin valores de demostración)', () => {
  assert.deepEqual(identityFrom(SETTINGS), { nombreSistema: 'SUPPLYFLOW QA', textoInferior: 'COMPRAS QA', empresaContratista: 'EMPRESA QA', idiomaPredeterminado: 'Español', idiomaClientes: 'English', idiomaProveedores: 'Español', logotipoUrl: null });
  assert.deepEqual(paramsFrom(SETTINGS), { monedaBase: 'MXN', prefijoRequisicion: 'REQ', prefijoOrdenCompra: 'OC', diasAlerta: '3', cotizacionesMinimas: '3', ivaDefecto: '16' });
  assert.deepEqual(approvalFrom(SETTINGS), { activarRegla: RULE_YES, monedaRegla: 'MXN', limiteArticulo: '15000', limiteTotal: '35000.02' });
  assert.equal(approvalFrom({ approvals: { enabled: false } }).activarRegla, RULE_NO);
  assert.deepEqual(conditionsFrom(SETTINGS).map(c => [c.activa, c.es]), [[true, 'Precios en {CURRENCY}.'], [false, 'Inactiva.']]);
  const e = emailFrom(SETTINGS);
  assert.equal(e.idiomaCliente, 'Usar el idioma de documentos para clientes');
  assert.equal(e.copiarAdministradores, false); assert.equal(e.avisarAvances, true); assert.equal(e.maxDestinatarios, '15');
  // Sin datos: vacíos, nunca valores inventados.
  assert.equal(identityFrom(null).nombreSistema, ''); assert.equal(paramsFrom(null).monedaBase, ''); assert.equal(approvalFrom(null).activarRegla, ''); assert.deepEqual(conditionsFrom(null), []);
});

test('cambios detectados respecto de MariaDB', () => {
  const p = paramsFrom(SETTINGS);
  assert.deepEqual(changedFields(p, { ...p }), []);
  assert.deepEqual(changedFields(p, { ...p, ivaDefecto: '8', prefijoRequisicion: 'REQ ' }), ['IVA por defecto %']);
  const c = conditionsFrom(SETTINGS);
  assert.deepEqual(changedConditions(c, c.map(x => ({ ...x }))), []);
  assert.deepEqual(changedConditions(c, [c[0], { ...c[1], activa: true }]), ['Condición 2']);
  assert.deepEqual(changedConditions(c, [c[0]]), ['Número de condiciones (2 → 1)']);
});

test('validación de identidad, parámetros y aprobaciones', () => {
  const i = identityFrom(SETTINGS);
  assert.equal(validateIdentity(i), null);
  assert.equal(validateIdentity({ ...i, nombreSistema: ' ' }).field, 'nombreSistema');
  assert.equal(validateIdentity({ ...i, idiomaClientes: '' }).field, 'idiomaClientes');
  assert.equal(validateIdentity(i, { logoFile: { type: 'image/svg+xml', size: 10 } }).field, 'logotipoUrl');
  assert.equal(validateIdentity(i, { logoFile: { type: 'image/png', size: 3 * 1024 * 1024 } }).field, 'logotipoUrl');
  const p = paramsFrom(SETTINGS);
  assert.equal(validateParams(p, CUR), null);
  assert.equal(validateParams({ ...p, monedaBase: 'EUR' }, CUR).field, 'monedaBase'); // solo monedas registradas
  assert.equal(validateParams({ ...p, prefijoOrdenCompra: 'oc' }, CUR).field, 'prefijoOrdenCompra');
  assert.equal(validateParams({ ...p, diasAlerta: '2.5' }, CUR).field, 'diasAlerta');
  assert.equal(validateParams({ ...p, cotizacionesMinimas: '0' }, CUR).field, 'cotizacionesMinimas');
  assert.equal(validateParams({ ...p, ivaDefecto: '101' }, CUR).field, 'ivaDefecto');
  const a = approvalFrom(SETTINGS);
  assert.equal(validateApprovals(a, CUR), null);
  assert.equal(validateApprovals({ ...a, activarRegla: '' }, CUR).field, 'activarRegla');
  assert.equal(validateApprovals({ ...a, limiteTotal: '0' }, CUR).field, 'limiteTotal');
  assert.equal(validateApprovals({ ...a, limiteArticulo: '1,000' }, CUR).field, 'limiteArticulo');
});

test('validación de condiciones y correos', () => {
  const c = conditionsFrom(SETTINGS);
  assert.equal(validateConditions(c), null);
  assert.equal(validateConditions([...c, { activa: true, es: 'x', en: '' }]).message, 'La condición 3 requiere texto en español y en inglés.');
  assert.match(validateConditions(Array.from({ length: MAX_CONDITIONS + 1 }, () => ({ activa: true, es: 'a', en: 'b' }))).message, /como máximo 8/);
  const e = emailFrom(SETTINGS);
  assert.equal(validateEmail(e), null);
  assert.equal(validateEmail({ ...e, correoResponder: 'no-es-correo' }).field, 'correoResponder');
  assert.equal(validateEmail({ ...e, maxDestinatarios: '51' }).field, 'maxDestinatarios');
  assert.equal(validateEmail({ ...e, idiomaCliente: 'Francés' }).field, 'idiomaCliente');
});

test('Guardar: sin cambios o validado y NO guardado (nunca éxito simulado)', () => {
  assert.equal(saveResult('params', []).kind, 'info');
  const r = saveResult('params', ['IVA por defecto %']);
  assert.equal(r.kind, 'locked');
  assert.match(r.text, /^Datos validados, pero no se guardó la matriz de parámetros/);
  assert.match(r.text, /Cambios detectados: IVA por defecto %\. No se guardó nada en MariaDB\.$/);
});

test('avisos de la política versionada (approval_policy_versions)', () => {
  const a = approvalFrom(SETTINGS);
  assert.deepEqual(approvalWarnings(a, SETTINGS.approvals.policy), []);
  const w = approvalWarnings({ ...a, monedaRegla: 'USD', limiteArticulo: '50000' }, SETTINGS.approvals.policy);
  assert.deepEqual(w, ['El límite total es menor que el límite por artículo.', 'La política versionada v2 está en MXN.', 'El límite por artículo difiere de la política versionada v2 (15000).']);
  assert.deepEqual(approvalWarnings(a, null), []);
});

test('historial, exportación e importación (solo verificación)', () => {
  assert.deepEqual(['Enviado', 'Omitido', 'failed', 'Pendiente'].map(statusTone), ['green', 'amber', 'red', 'gray']);
  assert.deepEqual(recipientLines([{ kind: 'Para', address: 'a@x.invalid' }, { kind: 'CC', address: 'b@x.invalid' }]), ['Para: a@x.invalid', 'CC: b@x.invalid']);
  assert.equal(utcText(null), '—');
  assert.equal(utcText('2026-11-20 23:49:40', true), new Date(Date.UTC(2026, 10, 20, 23, 49, 40)).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }));
  const x = exportConfig(SETTINGS, new Date('2026-11-23T12:00:00Z'));
  assert.equal(x.exported_at, '2026-11-23T12:00:00.000Z'); assert.equal(x.identity.logo, 'registrado'); assert.equal(x.parameters.tax_pct, 16);
  assert.ok(!JSON.stringify(x).includes('password'));
  assert.equal(importCheck('{').ok, false);
  assert.equal(importCheck('[1]').ok, false);
  const ok = importCheck(JSON.stringify(x));
  assert.equal(ok.ok, true); assert.match(ok.message, /No se aplicó/);
});
