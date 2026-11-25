# Demo Quishing — Auditoría de Sistemas

Demostración **educativa e inofensiva** de un ataque de *quishing* (phishing por código QR)
para concientizar a una audiencia sobre el riesgo de escanear códigos QR desconocidos.

> ⚠️ **No roba datos.** No pide contraseñas ni OTP, no instala nada y no guarda ni envía
> información. Solo muestra a cada persona la "huella" que su propio dispositivo entrega
> automáticamente al visitar una web, para ilustrar el riesgo. Úsalo únicamente con
> **consentimiento** de la audiencia y con fines educativos.

## Qué es

Es un frontend estático servido por un pequeño servidor Express. Tiene dos modos:

- **Modo expositor** (enlace de la demo + `#presentar`, o el botón del pie): muestra un
  QR grande para proyectar. La audiencia lo escanea.
- **Modo audiencia** (lo que ven al escanear): un señuelo de un "banco" ficticio y, al
  tocar el botón, la revelación de que cayeron en quishing + la información que la página
  ya conoce de su dispositivo + consejos de prevención.

## Requisitos

- Node.js 18 o superior.

## Uso local

```bash
npm install
npm start
```

Luego abre http://localhost:3000

- Audiencia: http://localhost:3000/
- Expositor (QR): http://localhost:3000/#presentar

## Despliegue

Es una app Node estándar; sirve para cualquier hosting que ejecute Node:

- **Render / Railway / Fly.io:** build command `npm install`, start command `npm start`.
- **VPS propio:** `npm install` y `npm start` (idealmente detrás de Nginx con HTTPS).

El servidor respeta la variable de entorno `PORT` (usa 3000 por defecto). El QR apunta
solo con `location.origin + pathname`, por lo que se adapta automáticamente a la URL
pública donde lo despliegues; no hay que configurar nada.

> 💡 **HTTPS recomendado.** Algunas funciones del navegador (como la batería) y la
> confianza de la cámara al escanear funcionan mejor sobre HTTPS.

## Estructura

```
.
├── public/
│   └── index.html     # Todo el frontend (HTML + CSS + JS)
├── server.js          # Servidor Express estático
├── package.json
└── README.md
```

## Nota legal y ética

Esta herramienta es una simulación de concientización, la misma técnica que usan los
equipos de seguridad para entrenar usuarios. Antes de usarla:

1. Anuncia que es una simulación de seguridad y pide el consentimiento de los participantes.
2. No la modifiques para capturar credenciales reales ni para suplantar a un banco real.
3. No la publiques como un sitio abierto indexable (ya incluye `noindex`).
