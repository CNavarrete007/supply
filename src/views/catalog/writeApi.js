// Catálogos (clientes y proveedores) · alta (POST) y actualización (PUT + If-Match) con CSRF e Idempotency-Key;
// logotipo privado (GET) y compresión del logotipo en el navegador.
import { LOGO_TYPES, LOGO_MAX_SOURCE_BYTES, LOGO_MAX_BYTES } from '../clients/form.mjs';

const KINDS = ['clients', 'suppliers', 'supplier-offerings'];

async function csrf() {
  const r = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  const b = await r.json().catch(() => ({}));
  if (!r.ok || !b.csrf_token) { const e = new Error('CSRF'); e.status = r.status; throw e; }
  return b.csrf_token;
}

/** Same `key` must be reused when retrying the same save (server replays instead of duplicating). */
export async function saveCatalogRecord(kind, { id, version, payload, key }) {
  if (!KINDS.includes(kind)) throw new Error('KIND');
  const token = await csrf();
  const r = await fetch(id ? `/api/v1/catalogs/${kind}/${encodeURIComponent(id)}` : `/api/v1/catalogs/${kind}`, {
    method: id ? 'PUT' : 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-SF-CSRF': token, 'Idempotency-Key': key, ...(id ? { 'If-Match': `"${version}"` } : {}) },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

/** Current logo as an object URL (null when there is none). The caller revokes it. */
export async function fetchCatalogLogo(kind, id, signal) {
  if (!KINDS.includes(kind)) return null;
  const r = await fetch(`/api/v1/catalogs/${kind}/${encodeURIComponent(id)}/logo`, { credentials: 'same-origin', cache: 'no-store', signal });
  if (!r.ok) return null;
  const blob = await r.blob();
  return LOGO_TYPES.includes(blob.type) ? URL.createObjectURL(blob) : null;
}

const readAsDataUrl = blob => new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = () => reject(fr.error); fr.readAsDataURL(blob); });

/**
 * Validates and compresses a chosen logo in the browser: PNG/JPG/WEBP only, ≤ 8 MB original, redrawn on a canvas
 * (max 512 px, metadata removed) as WEBP (PNG fallback) and ≤ 400 KB. The server validates the bytes again.
 * @returns {Promise<{dataUrl:string,name:string,size:number,width:number,height:number,type:string}>}
 */
export async function compressLogo(file) {
  if (!file || !LOGO_TYPES.includes(file.type)) throw new Error('TYPE');
  if (file.size > LOGO_MAX_SOURCE_BYTES) throw new Error('SIZE');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('DECODE')); i.src = url; });
    let side = 512;
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale)); const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      let blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.86));
      if (!blob || blob.type !== 'image/webp') blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      if (blob && blob.size <= LOGO_MAX_BYTES) {
        const base = (file.name || 'logotipo').replace(/\.[^.]+$/, '');
        return { dataUrl: await readAsDataUrl(blob), name: `${base}.${blob.type === 'image/webp' ? 'webp' : 'png'}`, size: blob.size, width: w, height: h, type: blob.type };
      }
      side = Math.round(side * 0.7);
    }
    throw new Error('SIZE');
  } finally { URL.revokeObjectURL(url); }
}
