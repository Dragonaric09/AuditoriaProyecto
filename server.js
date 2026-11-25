"use strict";

const express = require("express");
const os = require("os");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

// Política de contenido: la página solo puede cargar sus propios archivos, las
// fuentes de Google, la librería del QR (cdnjs) y la consulta de IP. Así la demo
// no puede enviar datos a ningún otro destino.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdnjs.cloudflare.com",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://ipwho.is",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.set({
    "Content-Security-Policy": CSP,
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
  });
  next();
});

// Archivos estáticos: index.html, styles.css, app.js
app.use(express.static(PUBLIC_DIR));

// Cualquier otra ruta devuelve la demo (útil si el QR apunta a una subruta).
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Direcciones IPv4 de esta computadora en la red local (para el QR de la audiencia).
function lanAddresses() {
  const found = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      // Node cambió el formato de `family` entre versiones: admitimos ambos.
      const isIPv4 = entry.family === "IPv4" || entry.family === 4;
      if (isIPv4 && !entry.internal) found.push(entry.address);
    }
  }
  return found;
}

const server = app.listen(PORT, () => {
  console.log("Demo Quishing lista.");
  console.log(`  Presentador (esta computadora): http://localhost:${PORT}/#presentar`);

  const lan = lanAddresses();
  if (lan.length === 0) {
    console.log("  No se detectó red local. Para que la audiencia escanee desde su teléfono, publica la app con HTTPS.");
    return;
  }
  console.log("  Audiencia (misma red Wi-Fi). Usa en el QR la dirección de tu Wi-Fi");
  console.log("  (suele empezar por 192.168. o 10.; las demás pueden ser redes virtuales):");
  for (const ip of lan) console.log(`    http://${ip}:${PORT}/`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`El puerto ${PORT} ya está en uso. Cierra la otra aplicación o elige otro puerto con la variable PORT.`);
  } else {
    console.error("No se pudo iniciar el servidor:", err.message);
  }
  process.exit(1);
});
