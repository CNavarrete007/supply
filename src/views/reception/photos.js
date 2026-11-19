// Recepción y Entrega · fotografías en el navegador: se comprimen a JPG (lado mayor ≤ 1600 px) y nunca se suben
// mientras el registro esté bloqueado. Compartido por la tarjeta 1 (recepción) y la tarjeta 2 (formato de entrega).
import { fitSize, photoError, PHOTO_MAX } from './receptionForm.mjs';

export function compressPhoto(file, en = false) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const { w, h } = fitSize(img.naturalWidth, img.naturalHeight); const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
      const data = c.toDataURL('image/jpeg', 0.8);
      resolve({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, original: file.size, size: Math.round(((data.length - 23) * 3) / 4), w, h, data });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(en ? `${file.name}: the image could not be read.` : `${file.name}: no se pudo leer la imagen.`)); };
    img.src = url;
  });
}

/** Validates and compresses the chosen files keeping at most PHOTO_MAX in total. → { photos, errors } */
export async function compressPhotos(files, current = 0, en = false) {
  const errs = []; const ok = [];
  for (const file of [...(files || [])]) { const err = photoError(file, en); if (err) errs.push(err); else ok.push(file); }
  const room = Math.max(0, PHOTO_MAX - current);
  if (ok.length > room) errs.push(en ? `Maximum ${PHOTO_MAX} photos: ${ok.length - room} were skipped.` : `Máximo ${PHOTO_MAX} fotografías: se omitieron ${ok.length - room}.`);
  const photos = [];
  for (const file of ok.slice(0, room)) { try { photos.push(await compressPhoto(file, en)); } catch (e) { errs.push(e.message); } }
  return { photos, errors: errs };
}

export function openPhoto(p) { const a = document.createElement('a'); a.href = p.data; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click(); }
