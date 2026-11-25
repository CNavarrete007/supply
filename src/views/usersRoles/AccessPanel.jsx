import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2, Copy } from 'lucide-react';
import { accessStatus, userAccess } from './api';
import { ACTIONS, accessView, validateAccessForm, accessPayload, accessError, accessDone } from './accessModel.mjs';

// Usuarios y roles › ficha del usuario › «Acceso y rol Master Admin» (25 nov 2026).
// Habilita a otra persona como Master Admin (contraseña temporal generada por el servidor y mostrada UNA vez; al entrar debe
// cambiarla), restablece su contraseña temporal o le retira el rol. Pide la contraseña del administrador (reautenticación),
// un motivo y, al habilitar, confirmar que es una persona distinta (revisión independiente de Control de cambios).
const newKey = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
  : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
const TONE = { green: 'bg-emerald-50 text-emerald-800 border-emerald-200', amber: 'bg-amber-50 text-amber-900 border-amber-200', gray: 'bg-slate-100 text-slate-600 border-slate-200', purple: 'bg-purple-50 text-purple-800 border-purple-200', blue: 'bg-blue-50 text-blue-800 border-blue-200' };
const MSG = { ok: 'bg-emerald-50 border-emerald-200 text-emerald-900', warn: 'bg-amber-50 border-amber-200 text-amber-900', danger: 'bg-rose-50 border-rose-200 text-rose-800', info: 'bg-blue-50 border-blue-200 text-blue-900' };
const EMPTY = { reason: '', password: '', independent: false };

export function AccessPanel({ user, meId, en = false, onChanged, notify }) {
  const tx = (es, e) => (en ? e : es);
  const v = accessView(user, meId, en);
  const [status, setStatus] = useState(null);
  const [action, setAction] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [temp, setTemp] = useState(null); // { password, expires, who } — solo en memoria, se borra al cambiar de usuario
  const pending = useRef(null);
  useEffect(() => { let alive = true; accessStatus().then(s => { if (alive) setStatus(s); }).catch(() => {}); return () => { alive = false; }; }, []);
  useEffect(() => { setAction(''); setForm(EMPTY); setMsg(null); setTemp(null); pending.current = null; }, [user?.id]);
  if (!user) return null;
  const chip = ([t, tone], id) => <span data-testid={id} className={`inline-block px-2.5 py-1 rounded-full text-[10.5px] font-black border ${TONE[tone]}`}>{t}</span>;
  const set = (k, val) => { setForm(f => ({ ...f, [k]: val })); setMsg(null); };

  const apply = async () => {
    if (busy) return;
    const problem = validateAccessForm(form, action, en);
    if (problem) { setMsg(['danger', problem]); return; }
    const data = accessPayload(form, action);
    const sig = JSON.stringify([user.id, user.version, data.action, data.reason]);
    if (!pending.current || pending.current.sig !== sig) pending.current = { sig, key: newKey() };
    setBusy(true); setMsg(['info', tx('Aplicando en MariaDB…', 'Applying in MariaDB…')]);
    let res;
    try { res = await userAccess({ id: user.id, version: user.version, key: pending.current.key, data }); }
    catch (e) { res = { ok: false, status: 0, data: { error: { message: e.message } } }; }
    finally { setBusy(false); }
    setForm(f => ({ ...f, password: '' })); // la contraseña del administrador nunca se conserva
    if (res.ok) {
      pending.current = null;
      const out = res.data;
      const text = accessDone(out, en);
      if (out.temporary_password) setTemp({ password: out.temporary_password, expires: out.temporary_password_expires_at, who: `${out.name} (${out.email})` });
      setMsg(['ok', text]); setAction(''); setForm(EMPTY);
      notify?.(tx('Acceso actualizado', 'Access updated'), text, 'success');
      onChanged?.();
      return;
    }
    const er = res.data?.error || {};
    if (!['REAUTH_FAILED', 'TOO_MANY_ATTEMPTS'].includes(er.code) && res.status) pending.current = null;
    if (er.code === 'STALE_VERSION') onChanged?.();
    setMsg(accessError(res.status, er.code, er.message, en));
  };

  const notice = status && !status.enabled ? (status.code === 'USERADMIN_GRANTS_INCOMPLETE'
    ? tx(`A la cuenta de administración de usuarios le faltan ${status.missing_grants.length} de ${status.expected_grants} permisos. El administrador debe volver a ejecutar provision (docs/usuarios/SEGUNDO_MASTER_ADMIN.md).`, 'The user administration account is missing privileges.')
    : status.code === 'USERADMIN_ACCOUNT_REJECTED' ? tx('MariaDB rechazó la cuenta de administración de usuarios: ejecuta provision y verify (docs/usuarios/SEGUNDO_MASTER_ADMIN.md).', 'MariaDB rejected the user administration account.')
      : tx('La administración de accesos aún no está habilitada en este equipo: la API se inició sin la cuenta supplyflow_useradmin_local (overlay compose.supply-useradmin.yml y su secreto). Pasos: docs/usuarios/SEGUNDO_MASTER_ADMIN.md (con respaldo previo y autorización).', 'Access management is not enabled on this computer yet.')) : null;

  return <div data-testid="user-access" className="p-4 sm:p-5 border border-purple-200 rounded-2xl bg-purple-50/30 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h4 className="text-sm font-black text-slate-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-purple-700" />{tx('Acceso y rol Master Admin (MariaDB)', 'Access and Master Admin role (MariaDB)')}</h4>
        <p className="text-[10.5px] text-slate-500 mt-0.5">{tx('Control de cambios exige que otro Master Admin revise las solicitudes: habilita aquí a una segunda persona.', 'Change control requires another Master Admin to review requests: enable a second person here.')}</p></div>
      <div className="flex flex-wrap gap-1.5">{chip(v.role, 'access-role')}{chip(v.credential, 'access-credential')}{chip(v.access, 'access-enabled')}</div>
    </div>
    {notice && <p role="alert" data-testid="access-status" data-code={status.code} className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs">⚠️ {notice}</p>}
    {v.note && <p data-testid="access-note" className="p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-700">{v.note}</p>}

    {temp && <div data-testid="access-temp" className="p-4 rounded-xl border-2 border-purple-400 bg-white space-y-2">
      <p className="text-xs font-black text-purple-900">{tx('Contraseña temporal de', 'Temporary password for')} {temp.who} — {tx('se muestra una sola vez', 'shown only once')}</p>
      <div className="flex flex-wrap items-center gap-2"><code data-testid="access-temp-value" className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm tracking-wider select-all">{temp.password}</code>
        <button type="button" onClick={() => navigator.clipboard?.writeText(temp.password).then(() => setMsg(['ok', tx('Copiada al portapapeles.', 'Copied to clipboard.')])).catch(() => {})} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50"><Copy className="w-3.5 h-3.5" />{tx('Copiar', 'Copy')}</button>
        <button type="button" onClick={() => setTemp(null)} className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-50">{tx('Ya la entregué · ocultar', 'Delivered · hide')}</button></div>
      <p className="text-[10.5px] text-slate-600">{tx(`Vence: ${temp.expires ? new Date(temp.expires).toLocaleString('es-MX') : 'en 72 horas'} · Entrégala por un canal seguro (en persona o por un medio distinto al correo de su cuenta). Al iniciar sesión deberá elegir una contraseña nueva; SupplyFlow no la vuelve a mostrar ni la guarda en texto.`, 'Expires in 72 hours. Deliver it through a secure channel; at sign-in a new password must be chosen.')}</p>
    </div>}

    {v.actions.length > 0 && <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tx('Acción de acceso', 'Access action')}>
        {v.actions.map(a => <label key={a} className={`px-3 py-2 rounded-xl border text-xs font-black cursor-pointer ${action === a ? (a === 'revoke_master_admin' ? 'bg-rose-600 text-white border-rose-600' : 'bg-purple-700 text-white border-purple-700') : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300'}`}>
          <input type="radio" name="access-action" value={a} checked={action === a} onChange={() => { setAction(a); setMsg(null); }} className="sr-only" aria-label={ACTIONS[a][en ? 1 : 0]} />{ACTIONS[a][en ? 1 : 0]}</label>)}
      </div>
      {action && <div data-testid="access-form" className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block md:col-span-2"><span className="block text-[11px] font-black text-slate-800 mb-1">{tx('Motivo (queda en la bitácora)', 'Reason (recorded in the activity log)')} *</span>
          <textarea aria-label={tx('Motivo del cambio de acceso', 'Reason for the access change')} value={form.reason} maxLength={500} rows={2} onChange={e => set('reason', e.target.value)} placeholder={tx('Ej. Segundo Master Admin para la revisión independiente de Control de cambios.', 'E.g. Second Master Admin for independent change reviews.')} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl" /></label>
        <label className="block"><span className="block text-[11px] font-black text-slate-800 mb-1">{tx('Tu contraseña (confirmación)', 'Your password (confirmation)')} *</span>
          <input type="password" autoComplete="current-password" aria-label={tx('Tu contraseña para confirmar', 'Your password to confirm')} value={form.password} maxLength={1024} onChange={e => set('password', e.target.value)} className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl" /></label>
        {action === 'grant_master_admin' && <label className="flex items-start gap-2 text-[11px] text-slate-700 md:col-span-2"><input type="checkbox" checked={form.independent} onChange={e => set('independent', e.target.checked)} aria-label={tx('Confirmo que es una persona distinta', 'I confirm it is a different person')} className="mt-0.5 w-4 h-4" />{tx('Confirmo que esta persona es distinta de mí y que revisará los cambios de forma independiente (nunca una segunda cuenta mía).', 'I confirm this person is different from me and will review changes independently (never a second account of mine).')}</label>}
        <div className="md:col-span-2"><button type="button" onClick={apply} disabled={busy} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md disabled:opacity-60 ${action === 'revoke_master_admin' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-gradient-to-r from-blue-600 to-purple-600'}`}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{tx('Aplicar', 'Apply')}: {ACTIONS[action][en ? 1 : 0]}</button></div>
      </div>}
    </div>}
    {msg && <p role={msg[0] === 'danger' ? 'alert' : 'status'} data-testid="access-msg" className={`p-3 rounded-xl border text-xs ${MSG[msg[0]] || MSG.info}`}>{msg[1]}</p>}
  </div>;
}
