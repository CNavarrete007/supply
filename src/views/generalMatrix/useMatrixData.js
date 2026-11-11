import { useEffect, useMemo, useState } from 'react';
import { listMatrix, matrixClients } from '../../matrixApi';
import { request as recoveryRequest } from '../recovery/api';
import { mergeStages } from './model.mjs';

/**
 * Shared read-only loader for Matriz General and Reportes (GET only, no demo fallback):
 * /matrix/clients, every page of /matrix/requisitions (50 = server limit) and /recovery/matrix (stages).
 * Each source reports its own status so one failure never hides the others.
 */
export function useMatrixData(revision = 0) {
  const [clients, setClients] = useState({ status: 'loading', error: null, items: [] });
  const [reqs, setReqs] = useState({ status: 'loading', error: null, items: [], total: 0 });
  const [stages, setStages] = useState({ status: 'loading', error: null, items: null });
  useEffect(() => {
    const c = new AbortController();
    setClients(x => ({ ...x, status: 'loading', error: null }));
    matrixClients(c.signal).then(r => { if (!c.signal.aborted) setClients({ status: 'ready', error: null, items: r.items || [] }); })
      .catch(e => { if (!c.signal.aborted) setClients({ status: 'error', error: e, items: [] }); });
    return () => c.abort();
  }, [revision]);
  useEffect(() => {
    const c = new AbortController();
    (async () => {
      setReqs(x => ({ ...x, status: 'loading', error: null }));
      try {
        let page = 1, items = [], total = 0;
        do {
          const r = await listMatrix({ page, pageSize: 50, q: '', client: 'all', has: 'all' }, c.signal);
          total = Number(r.total) || 0; items = items.concat(r.items || []); page += 1;
          if (!c.signal.aborted) setReqs(x => ({ ...x, items, total }));
        } while (items.length < total && page <= 400 && !c.signal.aborted);
        if (!c.signal.aborted) setReqs({ status: 'ready', error: null, items, total });
      } catch (e) { if (!c.signal.aborted) setReqs(x => ({ ...x, status: 'error', error: e })); }
    })();
    return () => c.abort();
  }, [revision]);
  useEffect(() => {
    const c = new AbortController();
    setStages({ status: 'loading', error: null, items: null });
    recoveryRequest('/matrix', { signal: c.signal }).then(r => { if (!c.signal.aborted) setStages({ status: 'ready', error: null, items: r.items || [] }); })
      .catch(e => { if (!c.signal.aborted) setStages({ status: 'error', error: e, items: null }); });
    return () => c.abort();
  }, [revision]);
  const rows = useMemo(() => mergeStages(reqs.items, stages.items), [reqs.items, stages.items]);
  const stagesDenied = stages.status === 'error' && [401, 403].includes(stages.error?.status);
  return { clients, reqs, stages, rows, ready: reqs.status === 'ready', stagesDenied };
}
