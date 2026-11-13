import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // html2pdf.js se carga bajo demanda (Descargar PDF); pre-empaquetarlo junto con html2canvas/jspdf evita que el servidor
  // de desarrollo lo optimice a mitad de sesión con fragmentos incompatibles. No afecta al build de producción.
  optimizeDeps: { include: ["html2pdf.js", "html2canvas", "jspdf"] },
});
