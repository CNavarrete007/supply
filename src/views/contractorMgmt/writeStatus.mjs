// Gestión del Contratista · aviso cuando el guardado en MariaDB no está habilitado en este equipo (cuenta supplyflow_mgmtwrite_local).
// Traduce GET /api/v1/contractor-management/write-status a un aviso antes de capturar. No habilita nada: explica qué falta.
export const MGMT_GUIDE = 'docs/gestion-contratista/GUARDADO_VALIDACION_ESTRATEGIA.md';
export const MGMT_BLOCKING_CODES = ['MGMT_WRITE_NOT_PROVISIONED', 'MGMT_WRITE_ACCOUNT_REJECTED', 'MGMT_WRITE_GRANTS_INCOMPLETE'];

/** null when saving is enabled (or the status is unknown). */
export function mgmtNotice(status, en = false) {
  if (!status || status.enabled) return null;
  const m = (es, e) => (en ? e : es);
  const missing = Array.isArray(status.missing_grants) ? status.missing_grants : [];
  switch (status.code) {
    case 'MGMT_WRITE_NOT_PROVISIONED':
      return { code: status.code, title: m('El guardado de Gestión del Contratista no está habilitado en este equipo', 'Saving Contractor Management is not enabled on this computer'),
        text: m('La API se inició sin la cuenta de escritura de Gestión del Contratista (overlay compose.supply-mgmtwrite.yml y su secreto). Puedes consultar y validar la captura, pero la validación y la estrategia no se guardarán en MariaDB.',
          'The API was started without the Contractor Management write account (compose.supply-mgmtwrite.yml overlay and its secret). You can browse and check the entry, but validations and strategies will not be saved to MariaDB.'),
        action: m(`Para habilitarlo, el administrador debe seguir «Activación en la PC» de ${MGMT_GUIDE} (con respaldo previo y autorización).`, `To enable it, the administrator must follow "Activación en la PC" in ${MGMT_GUIDE} (backup first, with authorization).`) };
    case 'MGMT_WRITE_ACCOUNT_REJECTED':
      return { code: status.code, title: m('MariaDB rechazó la cuenta de escritura de Gestión del Contratista', 'MariaDB rejected the Contractor Management write account'),
        text: m('La cuenta supplyflow_mgmtwrite_local no existe en esta base o su contraseña no coincide con el secreto. La validación y la estrategia no se guardarán.', 'The supplyflow_mgmtwrite_local account does not exist in this database or its password does not match the secret. Nothing will be saved.'),
        action: m(`El administrador debe ejecutar provision y verify de la cuenta (${MGMT_GUIDE}).`, `The administrator must run the account's provision and verify steps (${MGMT_GUIDE}).`) };
    case 'MGMT_WRITE_GRANTS_INCOMPLETE':
      return { code: status.code, title: m('A la cuenta de escritura de Gestión del Contratista le faltan permisos', 'The Contractor Management write account is missing privileges'),
        text: m(`Faltan ${missing.length} de ${status.expected_grants || '?'} permisos (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}). Algunos guardados fallarán.`, `${missing.length} of ${status.expected_grants || '?'} privileges are missing. Some saves will fail.`),
        action: m(`El administrador debe volver a ejecutar provision: agrega solo los permisos que faltan (${MGMT_GUIDE}).`, `The administrator must run provision again (${MGMT_GUIDE}).`) };
    default:
      return { code: status.code || 'MGMT_WRITE_UNAVAILABLE', title: m('No se pudo comprobar el guardado de Gestión del Contratista', 'Could not check whether Contractor Management can save'),
        text: m('No fue posible verificar la conexión de escritura con MariaDB. Si al guardar aparece un error, revisa que la base y la API estén en línea.', 'The write connection could not be verified.'), action: '' };
  }
}

/** Save-time message for a configuration code; null for any other code. */
export function mgmtConfigErrorText(code, en = false) {
  if (!MGMT_BLOCKING_CODES.includes(code)) return null;
  const n = mgmtNotice({ enabled: false, code, missing_grants: [] }, en);
  return `${n.title}. ${en ? 'Nothing was saved.' : 'No se guardó nada.'} ${n.action}`;
}
