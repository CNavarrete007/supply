// Clientes · pruebas de la lógica pura. Ejecutar: node --test tests/frontend/clients_model.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHeader, mapHeaders, splitMulti, analyzeImport, initials, clientIndicators, TEMPLATE_HEADERS } from '../../src/views/clients/model.mjs';

test('headers: original English names and Spanish equivalents, accent/case-insensitive', () => {
  assert.equal(normalizeHeader('  Razón Social / Legal Company Name '), 'razon social legal company name');
  const { map, unknown, recognized } = mapHeaders(['Client number', 'Legal / company name', 'Brand name', 'RFC', 'Email', 'Email 2', 'Contact', 'Contacto 3', 'Proyecto', 'No. de contrato', 'Zona']);
  assert.deepEqual([map.code, map.name, map.brand, map.rfc, map.project, map.contract], [0, 1, 2, 3, 8, 9]);
  assert.deepEqual(map.emails, [4, 5]);
  assert.deepEqual(map.contacts, [6, 7]);
  assert.deepEqual(unknown, ['Zona']);
  assert.equal(recognized, 10);
  assert.deepEqual(mapHeaders(TEMPLATE_HEADERS).unknown, [], 'template is fully recognized');
});

test('multi-value cells split by ; , | and newline', () => {
  assert.deepEqual(splitMulti('a@x.com; b@x.com,c@x.com | d@x.com\ne@x.com'), ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com']);
  assert.deepEqual(splitMulti(''), []);
});

const H = ['Client number', 'Legal / company name', 'Project', 'Contract number', 'Email'];
test('outcomes: new, incomplete, existing (case-insensitive), repeated in file, empty rows ignored', () => {
  const rows = [
    ['QA03', 'Nuevo SA', 'P1', 'C1', 'ok@x.com'],
    ['qa01', 'Existe SA', 'P1', 'C1', ''],          // exists as QA01 (case-insensitive)
    ['QA04', '', '', '', 'mal-correo'],              // incomplete: name, project, contract, email
    ['', 'Sin número SA', 'P', 'C', ''],             // incomplete: code
    ['QA03', 'Repetido', 'P', 'C', ''],              // repeated in file
    ['', '', '', '', ''],                            // empty → ignored
  ];
  const a = analyzeImport(H, rows, ['QA01', 'QA02']);
  assert.deepEqual(a.rows.map(r => r.outcome), ['new', 'existing_skip', 'new_incomplete', 'new_incomplete', 'duplicate_in_file']);
  assert.deepEqual(a.rows[2].issues, ['name', 'project', 'contract', 'email']);
  assert.deepEqual(a.rows[3].issues, ['code']);
  assert.deepEqual(a.counts, { total: 5, new: 1, new_incomplete: 2, existing_skip: 1, existing_update: 0, duplicate_in_file: 1 });
  assert.equal(analyzeImport(H, rows, ['QA01'], { duplicateMode: 'update' }).rows[1].outcome, 'existing_update');
});

test('defaults fill missing project/contract and remove those issues', () => {
  const a = analyzeImport(H, [['QA09', 'Con defaults', '', '', '']], [], { defaultProject: 'PRY', defaultContract: 'CTO' });
  assert.equal(a.rows[0].outcome, 'new');
  assert.equal(a.rows[0].project, 'PRY');
});

test('initials and indicators', () => {
  assert.equal(initials('Cliente Sintético Uno, S.A. de C.V.'), 'CS');
  assert.equal(initials(''), '—');
  const summary = { total: 3, incomplete: 1, statuses: [{ code: 'active', count: 2 }, { code: 'inactive', count: 1 }] };
  const ind = clientIndicators(summary, [{ portal_enabled: true }, { portal_enabled: false }, { portal_enabled: true }], [{ id: 'a', name: 'B', requisitions: 2 }, { id: 'b', name: 'A', requisitions: 5 }, { id: 'c', name: 'C', requisitions: 0 }]);
  assert.equal(ind.active, 2); assert.equal(ind.portal, 2); assert.equal(ind.withRequisitions, 2);
  assert.deepEqual(ind.top.map(x => x.id), ['b', 'a']);
  assert.equal(clientIndicators(summary, [{}], []).portal, null, 'partial list → portal unknown');
});

import { policyOption, repeatPolicyView } from '../../src/views/clients/model.mjs';
test('política de precios y recompra: valores guardados, sin inventar opciones', () => {
  assert.deepEqual(policyOption('Precio sujeto a nueva cotización'), { value: 'Precio sujeto a nueva cotización', label: 'Precio sujeto a nueva cotización', known: true, empty: false });
  assert.equal(policyOption('RECOTIZAR PROVEEDORES SIEMPRE', true).label, 'Always re-quote suppliers');
  assert.deepEqual(policyOption('reuse_if_valid'), { value: 'reuse_if_valid', label: 'Reutilizar proveedor/costo si está vigente', known: true, empty: false }, 'código del catálogo');
  assert.deepEqual(policyOption('xyz_legacy'), { value: 'xyz_legacy', label: 'xyz_legacy', known: false, empty: false }, 'valor fuera del catálogo se muestra tal cual');
  assert.equal(policyOption(null).empty, true);
  const v = repeatPolicyView({ sales_policy: null, sourcing_policy: 'x', price_validity_days: 0, contract_reference: 'RC', contract_valid_until: '2026-12-31', min_margin_pct: '12.500000', updated_at: '2026-11-11 19:06:51.8' });
  assert.deepEqual([v.days, v.daysNote, v.margin, v.validUntil, v.contractReference, v.empty], ['0', 'Sin vencimiento automático por días', '12.5', '2026-12-31', 'RC', false]);
  assert.equal(repeatPolicyView({ price_validity_days: 30 }).daysNote, 'Precio histórico vigente por 30 días');
  assert.equal(repeatPolicyView(undefined).empty, true);
  assert.equal(repeatPolicyView({ price_validity_days: null }).days, '');
});
