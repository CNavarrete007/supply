// Usuarios y roles · gestión de acceso (25 nov 2026) · lógica pura (sin red).
// POST /api/v1/users/{id}/access: grant_master_admin | reset_password | revoke_master_admin, con la contraseña del administrador
// (reautenticación), motivo, If-Match e Idempotency-Key. La contraseña temporal la genera el servidor y se muestra UNA vez; al
// iniciar sesión con ella, el usuario debe elegir una nueva (POST /api/v1/auth/password/change).

export const ACTIONS = {
  grant_master_admin: ['Habilitar como Master Admin', 'Enable as Master Admin'],
  reset_password: ['Restablecer contraseña temporal', 'Reset temporary password'],
  revoke_master_admin: ['Retirar Master Admin', 'Remove Master Admin'],
};

const isMaster = u => (u?.role_codes || []).includes('master_admin');

/** Current access of a user and the actions this administrator may apply (never on their own account). */
export function accessView(user, meId, en = false) {
  const m = (es, e) => (en ? e : es);
  const admin = isMaster(user);
  const cred = user?.credential_state;
  const active = user?.status === 'active';
  const credential = cred === 'local_validated' ? [m('Contraseña activa', 'Active password'), 'green']
    : cred === 'external' ? [m('Proveedor externo', 'External provider'), 'blue']
      : user?.access_enabled ? [m('Temporal: debe cambiarla al entrar', 'Temporary: must change it at sign-in'), 'amber'] : [m('Sin contraseña', 'No password'), 'gray'];
  const self = !!user && user.id === meId;
  const actions = [];
  let note = '';
  if (self) note = m('Es tu propia cuenta: otro Master Admin debe cambiar tu acceso. Para cambiar tu contraseña usa «Cambiar contraseña» en la pantalla de inicio de sesión.',
    'This is your own account: another Master Admin must change your access. To change your password use "Change password" on the sign-in screen.');
  else if (!active) note = m('El usuario no está activo: no se le puede dar acceso.', 'The user is not active: access cannot be granted.');
  else if (cred === 'external') note = m('Se autentica con un proveedor externo; su contraseña no se administra aquí.', 'Authenticates with an external provider; its password is not managed here.');
  else {
    // Ya Master Admin: «Restablecer» cubre la contraseña temporal y vuelve a habilitar el acceso.
    if (!admin) actions.push('grant_master_admin');
    else actions.push('reset_password', 'revoke_master_admin');
  }
  return {
    admin, self, actions, note,
    role: admin ? ['Master Admin', 'purple'] : [m('Sin rol Master Admin', 'No Master Admin role'), 'gray'],
    credential,
    access: user?.access_enabled ? [m('Acceso habilitado', 'Access enabled'), 'green'] : [m('Sin acceso', 'No access'), 'gray'],
  };
}

/** First problem of the confirmation form (or null). */
export function validateAccessForm(f, action, en = false) {
  const m = (es, e) => (en ? e : es);
  if (!ACTIONS[action]) return m('Elige una acción.', 'Choose an action.');
  const reason = String(f.reason || '').replace(/\s+/g, ' ').trim();
  if (reason.length < 10 || reason.length > 500) return m('Escribe el motivo (10 a 500 caracteres).', 'Write the reason (10 to 500 characters).');
  if (!f.password) return m('Escribe tu contraseña para confirmar.', 'Type your password to confirm.');
  if (action === 'grant_master_admin' && !f.independent) return m('Confirma que esta persona es distinta de ti y revisará los cambios de forma independiente.', 'Confirm this person is different from you and will review changes independently.');
  return null;
}

export const accessPayload = (f, action) => ({ action, actor_password: f.password, reason: String(f.reason || '').replace(/\s+/g, ' ').trim() });

/** Server error → [tone, message]. */
export function accessError(status, code, message, en = false) {
  const m = (es, e) => (en ? e : es);
  if (!status) return ['danger', m(`No se confirmó el resultado (${message || 'sin respuesta'}). Pulsa «Aplicar» para reintentar la MISMA operación; no se duplicará. Si se generó una contraseña temporal no se volverá a mostrar: en ese caso usa «Restablecer contraseña temporal».`, 'The result was not confirmed. Apply again to retry the same operation.')];
  if (status === 401) return ['danger', m('Tu sesión expiró. Inicia sesión nuevamente; no se aplicaron cambios.', 'Your session expired; nothing was changed.')];
  if (code === 'REAUTH_FAILED') return ['danger', m('Tu contraseña no es correcta. No se aplicaron cambios.', 'Your password is not correct. Nothing was changed.')];
  if (code === 'TOO_MANY_ATTEMPTS') return ['danger', m('Demasiados intentos de confirmación. Espera 15 minutos.', 'Too many confirmation attempts. Wait 15 minutes.')];
  if (code === 'STALE_VERSION') return ['warn', m('El usuario cambió desde que abriste la ficha. Se recargó; revisa y vuelve a aplicar.', 'The user changed. It was reloaded; review and apply again.')];
  if (['USERADMIN_NOT_PROVISIONED', 'USERADMIN_ACCOUNT_REJECTED', 'USERADMIN_GRANTS_INCOMPLETE'].includes(code)) return ['warn', `${message} ${m('Pasos: docs/usuarios/SEGUNDO_MASTER_ADMIN.md (con respaldo previo y autorización).', 'Steps: docs/usuarios/SEGUNDO_MASTER_ADMIN.md.')}`];
  if (status === 403 && code === 'CSRF_INVALID') return ['danger', m('La sesión de seguridad cambió. Vuelve a intentarlo.', 'The security token changed. Try again.')];
  if (status === 403) return ['danger', m('Solo un Master Admin administra accesos.', 'Only a Master Admin manages access.')];
  return ['danger', message || m('No se pudo aplicar el cambio de acceso.', 'The access change could not be applied.')];
}

/** Message after a confirmed change. */
export function accessDone(out, en = false) {
  const m = (es, e) => (en ? e : es);
  const who = `${out.name} (${out.email})`;
  const s = out.sessions_revoked ? m(` Se cerraron ${out.sessions_revoked} sesión(es) abiertas.`, ` ${out.sessions_revoked} open session(s) were closed.`) : '';
  if (out.replayed) return m(`La operación ya se había aplicado a ${who}; no se repitió.${out.temporary_password_issued ? ' La contraseña temporal no se vuelve a mostrar: si no la guardaste, usa «Restablecer contraseña temporal».' : ''}`, `The operation had already been applied to ${who}.`);
  if (out.action === 'revoke_master_admin') return m(`${who} ya no es Master Admin.${out.access_enabled ? '' : ' Su acceso quedó deshabilitado (no tiene otro rol).'}${s}`, `${who} is no longer a Master Admin.${s}`);
  if (out.action === 'reset_password') return m(`Se generó una nueva contraseña temporal para ${who}.${s}`, `A new temporary password was generated for ${who}.${s}`);
  return out.temporary_password_issued
    ? m(`${who} ya es Master Admin. Entrégale la contraseña temporal por un canal seguro: al iniciar sesión deberá elegir una nueva.${s}`, `${who} is now a Master Admin. Give them the temporary password through a secure channel.${s}`)
    : m(`${who} ya es Master Admin y conserva su contraseña actual.${s}`, `${who} is now a Master Admin and keeps the current password.${s}`);
}

/** Same rules as the server (UserAccessInput::passwordProblem). */
export function passwordProblem(next, email = '', current = '', en = false) {
  const m = (es, e) => (en ? e : es);
  const s = String(next || '');
  if (/[\u0000-\u001f\u007f]/.test(s)) return m('La contraseña contiene caracteres no permitidos.', 'The password contains invalid characters.');
  const chars = [...s];
  if (chars.length < 12 || new TextEncoder().encode(s).length > 128) return m('La contraseña debe tener entre 12 y 128 caracteres.', 'The password must have 12 to 128 characters.');
  if (!/\p{L}/u.test(s) || !/\p{N}/u.test(s)) return m('La contraseña debe combinar letras y números.', 'The password must combine letters and numbers.');
  if (new Set(chars).size < 5) return m('La contraseña repite demasiados caracteres.', 'The password repeats too many characters.');
  const local = String(email || '').split('@')[0].toLowerCase();
  if (local.length >= 4 && s.toLowerCase().includes(local)) return m('La contraseña no puede contener tu usuario.', 'The password cannot contain your username.');
  if (current && s === current) return m('La nueva contraseña debe ser distinta de la actual.', 'The new password must be different from the current one.');
  return null;
}
