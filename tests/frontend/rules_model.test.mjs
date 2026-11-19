// Gestión del Contratista · tarjeta 4 "Reglas inteligentes": lógica pura (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES_NOTE_ES, ruleRows, blockText, truncatedText } from '../../src/views/contractorMgmt/rulesModel.mjs';

test('tres reglas del diseño en orden, con tono y texto', () => {
  const r = ruleRows({ without_validation: 278, blocked: 1, ready: 33 });
  assert.deepEqual(r.map(x => [x.key, x.count, x.text, x.tone]), [['without_validation', 278, 'requisiciones sin validación.', 'amber'], ['blocked', 1, 'validaciones con bloqueo.', 'red'], ['ready', 33, 'requisiciones listas para cotizar.', 'green']]);
  assert.deepEqual(ruleRows({}).map(x => x.count), [0, 0, 0]);
  assert.equal(ruleRows({}, true)[2].text, 'requisitions ready to quote.');
  assert.equal(RULES_NOTE_ES, 'Para avanzar, las validaciones técnica y contractual deben ser conformes o con observaciones aceptables, y el presupuesto debe estar disponible o parcialmente disponible.');
});

test('motivo del bloqueo y aviso de lista truncada', () => {
  assert.equal(blockText({ technical: 'Conforme', contract: 'Pendiente', budget: 'No disponible' }), 'contractual pendiente, presupuesto no disponible');
  assert.equal(truncatedText(100, 278), 'Mostrando 100 de 278.');
  assert.equal(truncatedText(28, 28), '');
});
