import React, { useEffect, useRef, useState } from 'react';
import { getNotifications } from './api';
import { badgeCount, badgeText, entityLabel, entityModule, whenText } from './model.mjs';

const PAGE = 10;
const REFRESH_MS = 60000;

/**
 * Campana de notificaciones: lee de MariaDB las notificaciones del usuario en sesión (GET /api/v1/notifications, solo lectura)
 * y muestra aparte los avisos de esta sesión del navegador (no se guardan). Marcar como leídas en MariaDB requiere un permiso
 * de escritura todavía no autorizado; "Marcar leídas" solo aplica a los avisos de esta sesión.
 */
export function NotificationBell({ language = 'es', local = [], onMarkLocalRead, onNavigate }) {
  const es = language === 'es';
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, page: 1, summary: { total: 0, unread: 0 }, error: null, more: false });
  const wrap = useRef(null);

  // Primera página (al montar, al cambiar el filtro, al abrir y cada minuto).
  useEffect(() => {
    const c = new AbortController();
    setState(s => ({ ...s, status: s.items.length ? s.status : 'loading', error: null }));
    getNotifications({ status: filter, page: 1, page_size: PAGE }, c.signal)
      .then(d => { if (!c.signal.aborted) setState({ status: 'ready', items: d.items, total: d.total, page: 1, summary: d.summary, error: null, more: false }); })
      .catch(e => { if (!c.signal.aborted) setState(s => ({ ...s, status: 'error', error: e })); });
    return () => c.abort();
  }, [filter, tick]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = e => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const loadMore = () => {
    const next = state.page + 1;
    setState(s => ({ ...s, more: true }));
    getNotifications({ status: filter, page: next, page_size: PAGE })
      .then(d => setState(s => ({ ...s, items: [...s.items, ...d.items], total: d.total, page: next, summary: d.summary, more: false })))
      .catch(e => setState(s => ({ ...s, more: false, error: e })));
  };

  const toggle = () => { setOpen(o => { if (!o) setTick(t => t + 1); return !o; }); };
  const go = entity => { const tab = entityModule(entity); if (tab && onNavigate) { onNavigate(tab); setOpen(false); } };
  const count = badgeCount(state.summary.unread, local);
  const localUnread = local.filter(n => !n.read).length;

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        data-testid="nb-button"
        onClick={toggle}
        aria-expanded={open}
        className="w-11 h-11 bg-white rounded-2xl border border-blue-100 flex items-center justify-center shadow-2xs hover:bg-slate-50 transition cursor-pointer"
        title={es ? `Notificaciones: ${count} sin leer` : `Notifications: ${count} unread`}
      >
        <span className="text-xl select-none">🔔</span>
      </button>
      {count > 0 && (
        <span data-testid="nb-badge" className="absolute -top-1.5 -right-1.5 bg-[#5b6e82] text-white text-[11px] font-black rounded-full min-w-5 h-5 px-1 flex items-center justify-center shadow-xs border-2 border-[#f0f4f8]">
          {badgeText(count)}
        </span>
      )}

      {open && (
        <div data-testid="nb-panel" className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 text-left">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
            <h3 className="text-xs font-black text-slate-800">{es ? 'Notificaciones' : 'Notifications'}</h3>
            <span data-testid="nb-summary" className="text-[10px] text-slate-500 font-bold">
              {state.status === 'ready' || state.items.length
                ? (es ? `${state.summary.unread} sin leer · ${state.summary.total} en MariaDB` : `${state.summary.unread} unread · ${state.summary.total} in MariaDB`)
                : ''}
            </span>
          </div>

          <div className="flex gap-1.5 mb-2">
            {[['all', es ? 'Todas' : 'All', state.summary.total], ['unread', es ? 'No leídas' : 'Unread', state.summary.unread]].map(([k, label, n]) => (
              <button
                key={k}
                type="button"
                data-testid={`nb-filter-${k}`}
                onClick={() => setFilter(k)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer ${filter === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <span className="text-[10px] font-extrabold">{label} ({n})</span>
              </button>
            ))}
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
            {state.status === 'loading' && !state.items.length && (
              <p data-testid="nb-status" className="text-xs text-center text-slate-400 py-4">{es ? 'Cargando notificaciones...' : 'Loading notifications...'}</p>
            )}
            {state.status === 'error' && (
              <div data-testid="nb-status" role="alert" className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-[11px] text-rose-800">
                {state.error?.message || (es ? 'No se pudieron leer las notificaciones.' : 'Notifications could not be read.')}
                {state.error?.status !== 401 && (
                  <button type="button" onClick={() => setTick(t => t + 1)} className="ml-2 underline cursor-pointer"><span className="text-[11px] font-extrabold">{es ? 'Reintentar' : 'Retry'}</span></button>
                )}
              </div>
            )}
            {state.status === 'ready' && !state.items.length && (
              <p data-testid="nb-status" className="text-xs text-center text-slate-400 py-4">
                {filter === 'unread' ? (es ? 'No tienes notificaciones sin leer' : 'No unread notifications') : (es ? 'No hay notificaciones' : 'No notifications')}
              </p>
            )}
            {state.items.map(n => (
              <div
                key={n.id}
                data-testid="nb-item"
                data-read={n.is_read ? '1' : '0'}
                className={`p-2 rounded-xl border ${n.is_read ? 'bg-slate-50 border-slate-100 opacity-75' : 'bg-blue-50/50 border-blue-100'}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="text-xs font-bold text-slate-800">{!n.is_read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5 align-middle" />}{n.title}</p>
                  <span className="text-[9px] text-slate-400 whitespace-nowrap">{whenText(n.created_at, es)}</span>
                </div>
                {n.message && <p className="text-[11px] text-slate-600 mt-0.5">{n.message}</p>}
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="text-[10px] text-slate-400">{n.sender_name ? `${es ? 'De' : 'From'}: ${n.sender_name}` : ''}</span>
                  {n.entity && (entityModule(n.entity) ? (
                    <button type="button" data-testid="nb-entity" onClick={() => go(n.entity)} className="text-[10px] font-extrabold text-blue-600 hover:underline cursor-pointer whitespace-nowrap">
                      <span className="text-[10px] font-extrabold">{entityLabel(n.entity, es)} →</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500">{entityLabel(n.entity, es)}</span>
                  ))}
                </div>
              </div>
            ))}
            {state.items.length < state.total && (
              <button type="button" data-testid="nb-more" disabled={state.more} onClick={loadMore} className="w-full py-1.5 rounded-xl border border-slate-200 text-[11px] font-extrabold text-slate-600 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
                <span className="text-[11px] font-extrabold">{state.more ? (es ? 'Cargando...' : 'Loading...') : (es ? `Ver más (${state.items.length} de ${state.total})` : `Show more (${state.items.length} of ${state.total})`)}</span>
              </button>
            )}

            {local.length > 0 && (
              <div data-testid="nb-local" className="pt-2 mt-1 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">{es ? 'En esta sesión (no se guardan)' : 'This session (not saved)'}</span>
                  {localUnread > 0 && (
                    <button type="button" data-testid="nb-local-read" onClick={onMarkLocalRead} className="text-blue-600 hover:underline cursor-pointer"><span className="text-[10px] font-bold">{es ? 'Marcar leídas' : 'Mark as read'}</span></button>
                  )}
                </div>
                {local.map(n => (
                  <div key={n.id} className={`p-2 rounded-xl border ${n.read ? 'bg-slate-50 border-slate-100 opacity-75' : 'bg-amber-50/50 border-amber-100'}`}>
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-slate-800">{n.title}</p>
                      <span className="text-[9px] text-slate-400">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{n.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p data-testid="nb-note" className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-snug">
            {es
              ? 'Solo lectura: las notificaciones vienen de MariaDB. Marcarlas como leídas allí requiere un permiso de escritura pendiente de autorización.'
              : 'Read-only: notifications come from MariaDB. Marking them as read there requires a write permission pending authorization.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
