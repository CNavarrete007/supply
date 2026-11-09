# Grupo Gerez — Módulo de Compras v1.1

Versión corregida del prototipo React + Tailwind CSS.

## Correcciones principales

- Buscador funcional en Resumen, Cotizaciones y Proveedores.
- Campanita de notificaciones con contador de no leídas, menú desplegable, marcar como leída y marcar todas como leídas.
- Nueva cotización con carga real de `.xlsx`, `.xls` y `.csv`.
- Vista previa de las primeras filas del archivo cargado.
- Las partidas importadas se contabilizan al crear la cotización.
- Pesos de evaluación dinámicos: al mover una barra, el sistema redistribuye automáticamente el resto para mantener 100%.
- El score de cada proveedor se recalcula inmediatamente con los pesos seleccionados.
- Motor de recomendación inteligente funcional: analiza los scores ponderados, identifica el primer y segundo lugar y explica por qué recomienda al ganador.
- Botón “Generar recomendación por IA” con estado de análisis.
- La recomendación se actualiza cuando cambian los pesos.

## Ejecutar

```bash
npm install
npm run dev
```

> La dependencia `xlsx` se utiliza para leer Excel directamente desde el navegador.

## Nota sobre “IA”

El prototipo incluye un motor de recomendación determinístico que funciona sin una API externa. Para convertirlo en IA generativa real se puede conectar posteriormente a un backend/API, manteniendo la misma interfaz.
