# Demo Quishing — Auditoría de Sistemas

Demostración **educativa e inofensiva** de un ataque de *quishing* (phishing por código QR)
para concientizar a una audiencia sobre el riesgo de escanear códigos QR desconocidos.

> ⚠️ **No roba datos.** No pide contraseñas ni OTP, no instala nada y no guarda ni envía
> información personal. Solo muestra a cada persona lo que su propio navegador entrega
> automáticamente al visitar una web, para ilustrar el riesgo. Al cargar la página se
> descargan la fuente tipográfica (Google Fonts) y la librería del QR (cdnjs), como en
> cualquier web. La consulta de IP a ipwho.is solo ocurre si la persona pulsa el botón.
> Úsalo únicamente con **consentimiento** de la audiencia y con fines educativos.

## Qué es

Es un frontend estático servido por un pequeño servidor Express. Tiene dos modos:

- **Modo expositor** (enlace de la demo + `#presentar`, o el botón del pie): muestra un
  QR grande para proyectar. La audiencia lo escanea.
- **Modo audiencia** (lo que ven al escanear): una entidad ficticia ("BancoDemo") y, al
  continuar, la revelación de que cayeron en quishing.

### Qué muestra la revelación

- **Tu huella digital:** un identificador calculado en el propio dispositivo a partir de
  sus atributos (canvas, GPU, fuentes, audio, pantalla, etc.). Se mantiene aunque la
  persona borre cookies o use una ventana de incógnito; la pantalla invita a comprobarlo.
- **Nivel de exposición** (bajo / medio / alto): una heurística según cuántas señales de
  alta identificación detecta.
- **Lista de datos con "¿para qué sirve?":** cada dato tiene un botón que explica cómo lo
  usaría un atacante. Se revelan de forma progresiva.
- **Huellas de alta entropía:** huella de canvas, modelo de GPU (WebGL), fuentes
  instaladas y huella de audio. En Chromium se afina la versión de Windows con
  `userAgentData`.
- **¿Te delata o te disfraza?:** detecta incoherencias típicas de herramientas de
  privacidad o de automatización (webdriver, plataforma vs. navegador, idiomas vacíos).
- **IP, bajo demanda:** un botón consulta la IP pública (única petición externa) y otro
  revela la IP de la red local por WebRTC **sin servidores externos** (si el navegador la
  protege con mDNS, lo explica).
- **Simulación de "envío" de datos:** a los 20 s aparece una alerta a pantalla completa
  con una cuenta atrás; a los 5 s restantes aparece un botón para detenerlo. Al pulsarlo
  (o al agotarse el tiempo) se explica qué podría desencadenar un solo toque y los riesgos.
  Al pulsar **detener** suena una alarma: una sirena sintetizada en el navegador (Web Audio)
  seguida de la voz del sistema diciendo «Alerta, peligro». No hay archivos de audio ni red.
  Si el teléfono está en modo silencio, es posible que no se oiga; la alerta visual sigue.
  El panel tiene un botón **Salir** siempre visible y hace scroll en pantallas pequeñas; en la
  pantalla del mapa, tras 10 s vuelve sola a los datos. **No se envía absolutamente nada:**
  la cuenta atrás es una dramatización local.
- **Ubicación aproximada:** ese mismo panel muestra un mapa con un área de 500 m de radio
  alrededor del lugar del evento. El mapa es una imagen **local** (`public/mapa-aula.jpg`,
  teselas de OpenStreetMap) y las coordenadas están fijadas en `index.html`; no se consulta
  ninguna geolocalización real. Para cambiar la sede: reemplaza esa imagen y las
  coordenadas del bloque `.geo`.

## Requisitos

- Node.js 18 o superior (`npm run dev` usa `node --watch`, disponible desde Node 18.11).

## Uso local

```bash
npm install
npm start
```

Luego abre http://localhost:3000

- Audiencia: http://localhost:3000/
- Expositor (QR): http://localhost:3000/#presentar

## Cómo proyectar la demo

1. **Avisa antes** a la audiencia que es una simulación y pide su consentimiento.
2. Abre el modo expositor **desde la dirección de red**, no desde `localhost`. La consola
   del servidor muestra las direcciones disponibles, por ejemplo `http://192.168.1.20:3000`.
   Un QR con `localhost` solo funciona en esa computadora.
3. La audiencia debe estar en la **misma red Wi-Fi** que el servidor. Si no, despliega la
   app (ver abajo) y usa su enlace público.
4. Usa **Ver la demo como la verá la audiencia** para revisar el recorrido antes de proyectar,
   y **Volver al inicio de la demo** para repetirlo sin recargar la página.

La pantalla del expositor avisa si el enlace no sirve (por ejemplo, si es `localhost`,
si no es una dirección válida o si el generador de QR no se pudo cargar).

## Despliegue

Es una app Node estándar; sirve para cualquier hosting que ejecute Node:

- **Render / Railway / Fly.io:** build command `npm install`, start command `npm start`.
- **VPS propio:** `npm install` y `npm start` (idealmente detrás de Nginx con HTTPS).

El servidor respeta la variable de entorno `PORT` (usa 3000 por defecto). El QR apunta
con `location.origin + pathname`, por lo que se adapta automáticamente a la URL pública
donde lo despliegues; no hay que configurar nada.

> 💡 **HTTPS recomendado.** Algunas funciones del navegador (como la batería) y la
> confianza de la cámara al escanear funcionan mejor sobre HTTPS.

## Seguridad del servidor

- **Política de contenido (CSP):** la página solo puede cargar sus propios archivos, las
  fuentes de Google, la librería de QR desde cdnjs y la consulta de IP. No puede enviar
  datos a otros destinos.
- **Integridad (SRI):** el script de QR se verifica con su hash; si cdnjs cambia el
  archivo, el navegador lo rechaza.
- **No indexable:** `noindex, nofollow` en la página y en la cabecera `X-Robots-Tag`.

## Estructura

```
.
├── public/
│   ├── index.html     # Marcado y sprite de iconos
│   ├── styles.css     # Estilos (tokens de color; modo oscuro automático)
│   └── app.js         # Lógica: huella, exposición, simulación de envío, QR
├── server.js          # Servidor Express: archivos estáticos y cabeceras de seguridad
├── package.json
└── README.md
```

## Nota legal y ética

Esta herramienta es una simulación de concientización, la misma técnica que usan los
equipos de seguridad para entrenar usuarios. Antes de usarla:

1. Anuncia que es una simulación de seguridad y pide el consentimiento de los participantes.
2. No la modifiques para capturar credenciales reales ni para suplantar a un banco real.
   La entidad "BancoDemo" es ficticia; si la cambias, usa un nombre igualmente ficticio.
3. No la publiques como un sitio abierto indexable (ya incluye `noindex`).
