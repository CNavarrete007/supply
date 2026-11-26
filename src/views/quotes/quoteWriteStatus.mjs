// Cotizaciones › Registro de cotización · aviso cuando el guardado en MariaDB no está habilitado en este equipo
// (cuenta supplyflow_quotewrite_local). Traduce GET /api/v1/quotes/write-status a un aviso antes de capturar. No habilita nada.
import { QUOTE_GUIDE } from './supplierQuote.mjs';

/** null when saving is enabled (or the status is unknown). */
export function quoteNotice(status, en = false) {
  if (!status || status.enabled) return null;
  const m = (es, e) => (en ? e : es);
  const missing = Array.isArray(status.missing_grants) ? status.missing_grants : [];
  switch (status.code) {
    case 'QUOTE_WRITE_NOT_PROVISIONED':
      return { code: status.code, title: m('El guardado de Cotizaciones no está habilitado en este equipo', 'Saving quotes is not enabled on this computer'),
        text: m('La API se inició sin la cuenta de escritura de Cotizaciones (overlay compose.supply-quotewrite.yml y su secreto). Puedes consultar y validar la captura, pero la cotización no se guardará en MariaDB.',
          'The API was started without the quotes write account (compose.supply-quotewrite.yml overlay and its secret). You can browse and check the entry, but the quote will not be saved to MariaDB.'),
        action: m(`Para habilitarlo, el administrador debe seguir «Activación en la PC» de ${QUOTE_GUIDE} (con respaldo previo y autorización).`, `To enable it, the administrator must follow "Activación en la PC" in ${QUOTE_GUIDE} (backup first, with authorization).`) };
    case 'QUOTE_WRITE_ACCOUNT_REJECTED':
      return { code: status.code, title: m('MariaDB rechazó la cuenta de escritura de Cotizaciones', 'MariaDB rejected the quotes write account'),
        text: m('La cuenta supplyflow_quotewrite_local no existe en esta base o su contraseña no coincide con el secreto. La cotización no se guardará.', 'The supplyflow_quotewrite_local account does not exist in this database or its password does not match the secret. Nothing will be saved.'),
        action: m(`El administrador debe ejecutar provision y verify de la cuenta (${QUOTE_GUIDE}).`, `The administrator must run the account's provision and verify steps (${QUOTE_GUIDE}).`) };
    case 'QUOTE_WRITE_GRANTS_INCOMPLETE':
      return { code: status.code, title: m('A la cuenta de escritura de Cotizaciones le faltan permisos', 'The quotes write account is missing privileges'),
        text: m(`Faltan ${missing.length} de ${status.expected_grants || '?'} permisos (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}). Algunos guardados fallarán.`, `${missing.length} of ${status.expected_grants || '?'} privileges are missing. Some saves will fail.`),
        action: m(`El administrador debe volver a ejecutar provision: agrega solo los permisos que faltan (${QUOTE_GUIDE}).`, `The administrator must run provision again (${QUOTE_GUIDE}).`) };
    default:
      return { code: status.code || 'QUOTE_WRITE_UNAVAILABLE', title: m('No se pudo comprobar el guardado de Cotizaciones', 'Could not check whether quotes can be saved'),
        text: m('No fue posible verificar la conexión de escritura con MariaDB. Si al guardar aparece un error, revisa que la base y la API estén en línea.', 'The write connection could not be verified.'), action: '' };
  }
}
