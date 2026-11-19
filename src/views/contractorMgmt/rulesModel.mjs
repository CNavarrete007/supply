// Gestión del Contratista · tarjeta 4 "Reglas inteligentes" · lógica pura (sin red).
// Datos: GET /api/v1/contractor-management/rules (contadores exactos y listas de hasta 100 registros).
import { blockReasons } from './validationForm.mjs';

export const RULES_NOTE_ES = 'Para avanzar, las validaciones técnica y contractual deben ser conformes o con observaciones aceptables, y el presupuesto debe estar disponible o parcialmente disponible.';
export const RULES_NOTE_EN = 'To move forward, the technical and contractual validations must be compliant or with acceptable observations, and the budget must be available or partially available.';

/** The three rule rows of the design (order, tone and text). */
export function ruleRows(counters = {}, en = false) {
  const m = (es, e) => (en ? e : es);
  return [
    { key: 'without_validation', count: Number(counters.without_validation) || 0, text: m('requisiciones sin validación.', 'requisitions without validation.'), tone: 'amber' },
    { key: 'blocked', count: Number(counters.blocked) || 0, text: m('validaciones con bloqueo.', 'validations with a block.'), tone: 'red' },
    { key: 'ready', count: Number(counters.ready) || 0, text: m('requisiciones listas para cotizar.', 'requisitions ready to quote.'), tone: 'green' },
  ];
}

/** Why a current validation blocks quoting (reuses the card 1 rule). */
export const blockText = (x, en = false) => blockReasons({ technical: x?.technical, contract: x?.contract, budget: x?.budget }, en);

/** "Mostrando 100 de 278" when the list is truncated ('' otherwise). */
export const truncatedText = (shown, total, en = false) => (total > shown ? (en ? `Showing ${shown} of ${total}.` : `Mostrando ${shown} de ${total}.`) : '');
