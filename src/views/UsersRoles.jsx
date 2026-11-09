import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, RefreshCw, Users, LockKeyhole, AlertCircle } from 'lucide-react';

/** Read-only directory. Create/edit/delete remain disabled until audited write contracts exist. */
export function UsersRoles({ lang = 'es', language, isEnglish }) {
  const en = isEnglish || lang === 'en' || language === 'en';
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [count, setCount] = useState(0);
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setBusy(true);
    setError('');
    Promise.all([
      fetch(`/api/v1/users?page=${page}`, { credentials: 'same-origin', cache: 'no-store', signal: ctrl.signal }),
      fetch('/api/v1/roles', { credentials: 'same-origin', cache: 'no-store', signal: ctrl.signal })
    ]).then(async ([userRes, roleRes]) => {
      if (!userRes.ok || !roleRes.ok) throw new Error(userRes.status === 403 ? 'Tu sesión no tiene permiso para consultar usuarios.' : 'No se pudieron consultar los datos de MariaDB.');
      return Promise.all([userRes.json(), roleRes.json()]);
    }).then(([u, r]) => {
      if (ctrl.signal.aborted) return;
      setUsers(Array.isArray(u.items) ? u.items : []);
      setCount(Number(u.total) || 0);
      setRoles(Array.isArray(r.items) ? r.items : []);
    }).catch(e => { if (!ctrl.signal.aborted) setError(e.message || 'Error de consulta.'); })
      .finally(() => { if (!ctrl.signal.aborted) setBusy(false); });
    return () => ctrl.abort();
  }, [page, revision]);

  const filtered = useMemo(() => users.filter(u => [u.name, u.email, u.position, ...(u.roles || [])]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(term.toLocaleLowerCase())), [users, term]);
  return (
    <section className="space-y-6">
      <header className="rounded-2xl bg-slate-900 text-white p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3"><Users size={25} /> {en ? 'Users and roles' : 'Usuarios y roles'}</h1>
          <p className="text-sm text-slate-300 mt-1">{en ? 'Real data from MariaDB · read-only first stage' : 'Datos reales desde MariaDB · primera etapa de solo consulta'}</p>
        </div>
        <button type="button" className="flex items-center gap-2 rounded-xl px-4 py-2 bg-blue-600 hover:bg-blue-500" onClick={() => setRevision(x => x + 1)}><RefreshCw size={16} /> {en ? 'Refresh' : 'Actualizar'}</button>
      </header>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5"><p className="text-xs uppercase text-slate-500 font-semibold">{en ? 'Users' : 'Usuarios'}</p><div className="text-3xl font-black text-slate-900 mt-1">{count}</div></div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5"><p className="text-xs uppercase text-slate-500 font-semibold">{en ? 'Roles' : 'Roles'}</p><div className="text-3xl font-black text-slate-900 mt-1">{roles.length}</div></div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5"><p className="text-xs uppercase text-slate-500 font-semibold">{en ? 'Active credentials (this page)' : 'Credenciales activadas (esta página)'}</p><div className="text-3xl font-black text-slate-900 mt-1">{users.filter(u => u.credential_state === 'local_validated').length}</div></div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-amber-900 text-sm"><LockKeyhole className="shrink-0" size={18}/><span>{en ? 'Creating, editing, blocking and deleting accounts are not enabled yet. Imported users remain intact.' : 'Altas, ediciones, bloqueos y eliminaciones aún no están habilitados. Los usuarios importados se mantienen intactos.'}</span></div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 flex flex-wrap justify-between items-center gap-3 border-b">
          <div className="font-bold text-slate-900">{en ? 'User directory' : 'Matriz de usuarios'}</div>
          <div className="relative max-w-sm w-full"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input aria-label={en ? 'Search users' : 'Buscar usuarios'} value={term} onChange={e => setTerm(e.target.value)} placeholder={en ? 'Search users...' : 'Buscar usuarios...'} className="pl-10 p-2 border rounded-lg w-full text-sm" /></div>
        </div>
        {busy && <p className="p-6 text-slate-600">{en ? 'Loading real records...' : 'Consultando registros reales...'}</p>}
        {error && <div role="alert" className="p-6 flex gap-2 text-red-700"><AlertCircle size={20} /> {error}</div>}
        {!busy && !error && <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">{en ? 'User' : 'Usuario'}</th><th className="p-3">{en ? 'Position' : 'Puesto'}</th><th className="p-3">{en ? 'Roles' : 'Roles'}</th><th className="p-3">{en ? 'Status' : 'Estatus'}</th><th className="p-3">{en ? 'Credentials' : 'Credenciales'}</th></tr></thead><tbody>
          {filtered.map(u => <tr key={u.id} className="border-t"><td className="p-3"><div className="font-semibold text-slate-900">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div><div className="text-xs text-slate-500">{u.phone || ''}</div></td><td className="p-3 text-slate-600">{u.position || '—'}</td><td className="p-3">{(u.roles || []).join(', ') || '—'}</td><td className="p-3">{u.status === 'active' ? (en ? 'Active' : 'Activo') : u.status}</td><td className="p-3">{u.credential_state === 'local_validated' ? <span className="text-emerald-700 flex gap-1"><ShieldCheck size={16}/> {en ? 'Enabled' : 'Activada'}</span> : <span className="text-amber-700">{en ? 'Reset required' : 'Pendiente de activación'}</span>}</td></tr>)}
          {filtered.length === 0 && <tr><td colSpan="5" className="p-5 text-center text-slate-500">{en ? 'No matching users.' : 'No hay coincidencias.'}</td></tr>}
        </tbody></table></div>}
        <div className="p-4 flex items-center justify-between border-t text-sm text-slate-500"><span>{en ? 'Page' : 'Página'} {page} · {count} {en ? 'total records' : 'registros totales'}</span><div className="flex gap-2"><button disabled={page === 1 || busy} className="px-3 py-1 border rounded disabled:opacity-40" onClick={() => setPage(p => p - 1)}>{en ? 'Previous' : 'Anterior'}</button><button disabled={page * 50 >= count || busy} className="px-3 py-1 border rounded disabled:opacity-40" onClick={() => setPage(p => p + 1)}>{en ? 'Next' : 'Siguiente'}</button></div></div>
      </div>
      <div className="rounded-xl bg-white border p-4"><h2 className="font-bold flex gap-2 items-center"><ShieldCheck size={18}/>{en ? 'Role catalog (read-only)' : 'Catálogo de roles (solo lectura)'}</h2><div className="flex flex-wrap gap-2 mt-3">{roles.map(r => <span key={r.code} className="text-xs bg-slate-100 rounded-lg px-3 py-2">{r.name} · {r.users}</span>)}</div></div>
    </section>
  );
}
