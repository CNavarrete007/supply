import React, { useCallback, useEffect, useRef } from 'react';
import { signatureFileError, safeSignature } from './poFormat.mjs';

// Recuadro de firma manuscrita: dibujo con mouse, pluma o dedo (Pointer Events), pegar imagen (Ctrl+V sobre el recuadro o
// "Pegar firma") y cargar imagen PNG/JPG. Toda imagen se normaliza a PNG en el navegador; nada se envía al servidor.
const INK = '#0f172a';

/** Draws a PNG/JPEG data URL (or blob) fitted and centered into the canvas; resolves with the canvas PNG data URL. */
function drawInto(canvas, src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d'); const w = canvas.width; const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const k = Math.min(w / img.naturalWidth, h / img.naturalHeight, 1) * 0.92;
      const dw = img.naturalWidth * k; const dh = img.naturalHeight * k;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('img'));
    img.src = src;
  });
}

export function SignaturePad({ role, title, description, value, status, onChange, onError, en = false }) {
  const tx = (es, e) => (en ? e : es);
  const canvasRef = useRef(null); const fileRef = useRef(null);
  const drawing = useRef(false); const last = useRef(null); const own = useRef('');

  // Canvas resolution follows its box once (2x for sharp strokes).
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const box = c.getBoundingClientRect(); const ratio = Math.max(2, window.devicePixelRatio || 1);
    c.width = Math.max(1, Math.round(box.width * ratio)); c.height = Math.max(1, Math.round(box.height * ratio));
  }, []);
  // Values produced here (stroke, paste, upload) are already on the canvas; external ones (clear, other PO) are redrawn.
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const v = value || '';
    if (v === own.current) return;
    own.current = v;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    if (safeSignature(v)) drawInto(c, v).catch(() => {});
  }, [value]);

  const point = e => { const c = canvasRef.current; const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }; };
  const down = e => { e.preventDefault(); const c = canvasRef.current; c.setPointerCapture?.(e.pointerId); drawing.current = true; last.current = point(e);
    const ctx = c.getContext('2d'); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(last.current.x, last.current.y, c.width / 400, 0, Math.PI * 2); ctx.fill(); };
  const move = e => {
    if (!drawing.current) return; e.preventDefault();
    const c = canvasRef.current; const ctx = c.getContext('2d'); const p = point(e); const pressure = e.pressure && e.pointerType === 'pen' ? 0.6 + e.pressure : 1;
    ctx.strokeStyle = INK; ctx.lineWidth = (c.width / 260) * pressure; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last.current = p;
  };
  const up = () => { if (!drawing.current) return; drawing.current = false; const url = canvasRef.current.toDataURL('image/png'); own.current = url; onChange(url); };

  const loadFile = useCallback(file => {
    const err = signatureFileError(file, en); if (err) { onError?.(err); return; }
    const reader = new FileReader();
    reader.onload = () => drawInto(canvasRef.current, String(reader.result)).then(url => { own.current = url; onChange(url); }).catch(() => onError?.(tx('No se pudo leer la imagen.', 'The image could not be read.')));
    reader.onerror = () => onError?.(tx('No se pudo leer la imagen.', 'The image could not be read.'));
    reader.readAsDataURL(file);
  }, [en, onChange, onError]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPaste = e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.kind === 'file' && /^image\/(png|jpeg)$/.test(i.type));
    if (!item) { onError?.(tx('El portapapeles no contiene una imagen PNG o JPG.', 'The clipboard does not contain a PNG or JPG image.')); return; }
    e.preventDefault(); loadFile(item.getAsFile());
  };
  const pasteButton = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) { const t = it.types.find(x => /^image\/(png|jpeg)$/.test(x)); if (t) { const b = await it.getType(t); loadFile(new File([b], `firma.${t.endsWith('png') ? 'png' : 'jpg'}`, { type: t })); return; } }
      onError?.(tx('El portapapeles no contiene una imagen PNG o JPG.', 'The clipboard does not contain a PNG or JPG image.'));
    } catch { onError?.(tx('El navegador no permitió leer el portapapeles: selecciona el recuadro y presiona Ctrl+V.', 'The browser did not allow reading the clipboard: select the box and press Ctrl+V.')); }
  };
  const has = !!safeSignature(value);

  return <div data-testid={`po-sign-${role}`} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/40 space-y-2.5">
    <div><h5 className="text-sm font-black text-slate-900">{title}</h5><p className="text-[10.5px] text-slate-500">{description}</p></div>
    <div tabIndex={0} role="group" aria-label={`${tx('Recuadro de firma', 'Signature box')}: ${title}`} onPaste={onPaste} className={`rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-400 border-2 ${has ? 'border-emerald-500' : 'border-dashed border-slate-300'}`}>
      <canvas ref={canvasRef} aria-label={`${tx('Área para firmar', 'Signing area')}: ${title}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} className="block w-full h-36 cursor-crosshair touch-none" />
    </div>
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
      <button type="button" onClick={() => onChange(null)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg">{tx('Limpiar', 'Clear')}</button>
      <button type="button" onClick={pasteButton} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-lg">{tx('Pegar firma', 'Paste signature')}</button>
      <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-lg">{tx('Cargar imagen', 'Upload image')}</button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" aria-label={`${tx('Imagen de firma', 'Signature image')}: ${title}`} className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) loadFile(f); }} />
      <span data-testid={`po-sign-status-${role}`} className={`text-[10.5px] ${status.tone}`}>{status.text}</span>
    </div>
  </div>;
}

export default SignaturePad;
