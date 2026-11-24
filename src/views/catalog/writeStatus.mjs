// Catálogos · estado del guardado en MariaDB (GET /api/v1/catalogs/write-status, solo lectura, Master Admin).
// Traduce el diagnóstico del servidor a un aviso claro que se muestra al abrir Clientes, Proveedores, Suministros y Categorías,
// antes de capturar, en lugar de descubrirlo al final del formulario. No habilita nada: solo explica qué falta y quién lo resuelve.

export const WRITE_STATUS_URL = '/api/v1/catalogs/write-status';
export const WRITE_BLOCKING_CODES = ['CATALOG_WRITE_NOT_PROVISIONED', 'CATALOG_WRITE_ACCOUNT_REJECTED', 'CATALOG_WRITE_GRANTS_INCOMPLETE'];
const DEFAULT_GUIDE = 'docs/clientes/ALTA_EDICION_CLIENTES.md';

// Tablas que usa el guardado de cada pantalla: un permiso faltante de OTRA tabla no afecta a esa pantalla (no se avisa ahí).
export const WRITE_TABLES = {
  clients: ['clients', 'business_entities', 'party_contacts', 'party_contact_channels', 'files', 'entity_files', 'audit_events', 'idempotency_keys'],
  suppliers: ['suppliers', 'business_entities', 'party_contacts', 'party_contact_channels', 'files', 'entity_files', 'categories', 'audit_events', 'idempotency_keys'],
  supplies: ['supplier_offerings', 'suppliers', 'business_entities', 'categories', 'audit_events', 'idempotency_keys'],
  categories: ['categories', 'requisition_items', 'suppliers', 'supplier_offerings', 'audit_events', 'idempotency_keys'],
  company: ['organizations', 'files', 'audit_events', 'idempotency_keys'],
};

/** entity: { es: 'clientes', en: 'clients', tables?, guide? }. Returns null when saving is enabled for that screen (or the status is unknown). */
export function writeStatusNotice(status, entity, en = false) {
  if (!status || status.enabled) return null;
  const m = (es, e) => (en ? e : es);
  const ent = en ? entity.en : entity.es;
  const GUIDE = entity.guide || DEFAULT_GUIDE;
  const all = Array.isArray(status.missing_grants) ? status.missing_grants : [];
  const missing = Array.isArray(entity.tables) ? all.filter(g => entity.tables.includes(String(g).split(' ')[1])) : all;
  if (status.code === 'CATALOG_WRITE_GRANTS_INCOMPLETE' && all.length && !missing.length) return null; // faltan permisos de otras pantallas
  switch (status.code) {
    case 'CATALOG_WRITE_NOT_PROVISIONED':
      return { code: status.code, title: m(`El guardado de ${ent} no está habilitado en este equipo`, `Saving ${ent} is not enabled on this computer`),
        text: m('La API se inició sin la cuenta de escritura del catálogo (overlay compose.supply-catalogwrite.yml y su secreto). Puedes consultar la información, pero los cambios no se guardarán en MariaDB.',
          'The API was started without the catalog write account (compose.supply-catalogwrite.yml overlay and its secret). You can browse, but changes will not be saved to MariaDB.'),
        action: m(`Para habilitarlo, el administrador debe seguir «Activación en la PC» de ${GUIDE} (con respaldo previo y autorización).`, `To enable it, the administrator must follow "Activación en la PC" in ${GUIDE} (backup first, with authorization).`) };
    case 'CATALOG_WRITE_ACCOUNT_REJECTED':
      return { code: status.code, title: m('MariaDB rechazó la cuenta de escritura del catálogo', 'MariaDB rejected the catalog write account'),
        text: m(`La cuenta supplyflow_catalogwrite_local no existe en esta base o su contraseña no coincide con el secreto. Los cambios de ${ent} no se guardarán.`,
          `The supplyflow_catalogwrite_local account does not exist in this database or its password does not match the secret. Changes to ${ent} will not be saved.`),
        action: m(`El administrador debe ejecutar provision y verify de la cuenta (${GUIDE}).`, `The administrator must run the account's provision and verify steps (${GUIDE}).`) };
    case 'CATALOG_WRITE_GRANTS_INCOMPLETE':
      return { code: status.code, title: m('A la cuenta de escritura del catálogo le faltan permisos', 'The catalog write account is missing privileges'),
        text: m(`Faltan ${missing.length} de ${status.expected_grants || '?'} permisos (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}). Algunos guardados de ${ent} fallarán.`,
          `${missing.length} of ${status.expected_grants || '?'} privileges are missing (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}). Some ${ent} saves will fail.`),
        action: m(`El administrador debe volver a ejecutar provision: agrega solo los permisos que faltan (${GUIDE}).`, `The administrator must run provision again: it only adds the missing privileges (${GUIDE}).`) };
    default:
      return { code: status.code || 'CATALOG_WRITE_UNAVAILABLE', title: m(`No se pudo comprobar el guardado de ${ent}`, `Could not check whether ${ent} can be saved`),
        text: m('No fue posible verificar la conexión de escritura con MariaDB. Si al guardar aparece un error, revisa que la base y la API estén en línea.',
          'The write connection to MariaDB could not be verified. If saving fails, check that the database and the API are online.'),
        action: '' };
  }
}

/** Save-time message for the configuration codes (shared by the catalog forms). Returns null for any other code. */
export function writeConfigErrorText(code, entity, en = false) {
  const n = writeStatusNotice({ enabled: false, code, missing_grants: [], expected_grants: null }, entity, en);
  if (!n || !WRITE_BLOCKING_CODES.includes(code)) return null;
  const lead = code === 'CATALOG_WRITE_GRANTS_INCOMPLETE' ? (en ? 'The catalog write account is missing privileges in MariaDB.' : 'A la cuenta de escritura del catálogo le faltan permisos en MariaDB.') : `${n.title}.`;
  return `${lead} ${en ? 'Nothing was saved.' : 'No se guardó nada.'} ${n.action}`;
}

let cache = null; // { at, promise }
/** Fetches the status once per minute (shared by the catalog screens). 401/403/network → null (no notice). */
export function loadWriteStatus(fetchImpl = (...a) => fetch(...a), now = Date.now()) {
  if (cache && now - cache.at < 60000) return cache.promise;
  const promise = fetchImpl(WRITE_STATUS_URL, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(r => (r.ok ? r.json() : null)).catch(() => null);
  cache = { at: now, promise };
  return promise;
}
export function resetWriteStatusCache() { cache = null; }
