/* Demo Quishing · lógica de la demostración.
 *
 * Todo se calcula en el navegador. La única petición que usa datos de conexión
 * es la consulta de IP, y solo ocurre si la persona pulsa el botón.
 */
(function () {
  "use strict";

  const IP_ENDPOINT = "https://ipwho.is/";
  const IP_TIMEOUT_MS = 8000;
  const IP_NOTE = "Esta consulta sí envía una petición a un servicio externo (ipwho.is), que ve tu dirección IP. Solo ocurre si la pulsas.";
  const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"];
  const QR_MIN = 200;
  const QR_MAX = 300;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const $ = (id) => document.getElementById(id);

  const views = { lure: $("lure"), reveal: $("reveal"), present: $("present") };
  const statValue = $("statValue");
  const fingerprint = $("fingerprint");
  const ipBtn = $("ipBtn");
  const ipNote = $("ipNote");
  const urlField = $("urlField");
  const alertsBox = $("alerts");
  const qrBox = $("qrbox");
  const copyStatus = $("copyStatus");

  // Incrementa en cada visita a la revelación. Las respuestas asíncronas de una
  // visita anterior se descartan para no escribir en la pantalla actual.
  let visit = 0;

  // ---------- Pantallas ----------
  function show(name) {
    Object.keys(views).forEach((key) => { views[key].hidden = key !== name; });
    window.scrollTo(0, 0);
    // Mover el foco a la pantalla nueva para que los lectores de pantalla la anuncien.
    views[name].focus({ preventScroll: true });
  }

  // ---------- Iconos (sprite definido en index.html) ----------
  function icon(name) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "ico");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", "#i-" + name);
    svg.appendChild(use);
    return svg;
  }

  // ---------- Huella del dispositivo ----------
  function parseUA(ua) {
    let m;
    let os = "Desconocido";
    if (/Windows NT 10\.0/.test(ua)) os = "Windows 10/11";
    else if (/Windows/.test(ua)) os = "Windows";
    else if ((m = /Android ([\d.]+)/.exec(ua))) os = "Android " + m[1];
    else if ((m = /OS ([\d_]+) like Mac OS X/.exec(ua))) os = "iOS " + m[1].replace(/_/g, ".");
    else if ((m = /Mac OS X ([\d_.]+)/.exec(ua))) os = "macOS " + m[1].replace(/_/g, ".");
    else if (/CrOS/.test(ua)) os = "Chrome OS";
    else if (/Linux/.test(ua)) os = "Linux";

    let browser = "Desconocido";
    if (/Edg(?:e|A|iOS)?\//.test(ua)) browser = "Edge";
    else if (/OPR\//.test(ua)) browser = "Opera";
    else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet";
    else if (/CriOS\//.test(ua)) browser = "Chrome (iOS)";
    else if (/FxiOS\//.test(ua)) browser = "Firefox (iOS)";
    else if (/Chrome\//.test(ua)) browser = "Chrome";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    else if (/Safari\//.test(ua)) browser = "Safari";

    let device = "Computadora";
    let deviceIcon = "monitor";
    if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobi/.test(ua))) {
      device = "Tablet";
      deviceIcon = "phone";
    } else if (/Mobi|iPhone|iPod/.test(ua)) {
      device = "Teléfono móvil";
      deviceIcon = "phone";
    }
    return { os, browser, device, deviceIcon };
  }

  function timeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (err) { return ""; }
  }

  function addRow(iconName, label, value) {
    if (value === undefined || value === null || value === "") return;
    const row = document.createElement("div");
    row.className = "data-row";

    const key = document.createElement("span");
    key.className = "k";
    key.appendChild(icon(iconName));
    key.appendChild(document.createTextNode(label));

    const val = document.createElement("span");
    val.className = "v";
    val.textContent = String(value);

    row.appendChild(key);
    row.appendChild(val);
    fingerprint.appendChild(row);
    statValue.textContent = String(fingerprint.children.length);
  }

  function fillFingerprint() {
    const current = ++visit;
    fingerprint.textContent = "";
    resetIp();

    const ua = parseUA(navigator.userAgent || "");
    const conn = navigator.connection;
    const langs = navigator.languages && navigator.languages.length
      ? navigator.languages.join(", ")
      : navigator.language;

    addRow(ua.deviceIcon, "Tipo de dispositivo", ua.device);
    addRow("monitor", "Sistema operativo", ua.os);
    addRow("globe", "Navegador", ua.browser);
    addRow("globe", "Idioma", langs);
    addRow("clock", "Zona horaria", timeZone());
    addRow("monitor", "Pantalla", screen.width + " × " + screen.height + " px");
    addRow("monitor", "Ventana", window.innerWidth + " × " + window.innerHeight + " px");
    if (window.devicePixelRatio) addRow("monitor", "Densidad", window.devicePixelRatio + "×");
    addRow("cpu", "Núcleos de CPU", navigator.hardwareConcurrency);
    addRow("cpu", "Memoria aprox.", navigator.deviceMemory ? navigator.deviceMemory + " GB" : "");
    addRow("phone", "Pantalla táctil", navigator.maxTouchPoints > 0 ? "Sí" : "No");
    if (conn && conn.effectiveType) addRow("wifi", "Tipo de red", conn.effectiveType);
    addRow("clock", "Hora exacta de la visita", new Date().toLocaleString());
    if (document.referrer) addRow("globe", "Página de origen", document.referrer);

    // La batería solo existe en algunos navegadores; es asíncrona.
    if (typeof navigator.getBattery === "function") {
      navigator.getBattery().then((b) => {
        if (current !== visit) return;
        addRow("battery", "Batería", Math.round(b.level * 100) + "%" + (b.charging ? " (cargando)" : ""));
      }).catch(() => {});
    }
  }

  // ---------- Consulta de IP (opcional, bajo demanda) ----------
  function resetIp() {
    ipBtn.hidden = false;
    ipBtn.disabled = false;
    ipBtn.textContent = "Consultar mi dirección IP";
    ipNote.textContent = IP_NOTE;
  }

  function lookupIp() {
    const current = visit;
    ipBtn.disabled = true;
    ipBtn.textContent = "Consultando…";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IP_TIMEOUT_MS);

    fetch(IP_ENDPOINT, { signal: controller.signal, cache: "no-store", referrerPolicy: "no-referrer" })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((d) => {
        if (current !== visit) return;
        if (!d || d.success === false) throw new Error("respuesta sin datos");
        addRow("pin", "Dirección IP", d.ip);
        addRow("pin", "Ubicación aprox.", [d.city, d.region, d.country].filter(Boolean).join(", "));
        if (d.connection && d.connection.isp) addRow("globe", "Proveedor de internet", d.connection.isp);
        ipBtn.hidden = true;
        ipNote.textContent = "Listo. Un atacante real obtiene esta misma información solo con que abras su página.";
      })
      .catch(() => {
        if (current !== visit) return;
        ipBtn.disabled = false;
        ipBtn.textContent = "Reintentar consulta de IP";
        ipNote.textContent = "No se pudo consultar. Aunque no lo veas, cualquier sitio que visites recibe tu IP con cada petición.";
      })
      .finally(() => clearTimeout(timer));
  }

  // ---------- Modo expositor (QR) ----------
  function currentUrl() {
    return location.origin + location.pathname;
  }

  function qrSize() {
    const available = Math.min(window.innerWidth, 520) - 140;
    return Math.round(Math.min(QR_MAX, Math.max(QR_MIN, available)));
  }

  // Avisos sobre el enlace que se va a codificar. Un "error" bloquea el QR;
  // un "warn" o "info" se muestra pero no impide generarlo.
  function checkUrl(url) {
    const alerts = [];
    if (location.protocol === "file:") {
      alerts.push({
        level: "warn",
        text: "Estás abriendo la demo como archivo. Para que el QR funcione, ejecuta «npm start» y abre http://localhost:3000/#presentar.",
      });
    }

    let parsed = null;
    try { parsed = new URL(url); } catch (err) { parsed = null; }
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      alerts.push({
        level: "error",
        text: "El enlace no es válido. Debe empezar con http:// o https://, por ejemplo http://192.168.1.20:3000.",
      });
      return alerts;
    }

    if (LOCAL_HOSTNAMES.includes(parsed.hostname)) {
      alerts.push({
        level: "warn",
        text: "Este enlace solo abre en esta computadora. Para que la audiencia lo escanee con su teléfono, usa la dirección de red que muestra la consola del servidor (por ejemplo http://192.168.1.20:3000).",
      });
    } else if (parsed.protocol === "http:") {
      alerts.push({
        level: "info",
        text: "Sin HTTPS, algunos navegadores muestran advertencias. Úsalo dentro de la red del aula o publica la app con HTTPS.",
      });
    }
    return alerts;
  }

  function setAlerts(alerts) {
    alertsBox.textContent = "";
    alerts.forEach((a) => {
      const box = document.createElement("div");
      box.className = "alert " + a.level;
      box.appendChild(icon(a.level === "info" ? "info" : "alert"));
      const p = document.createElement("p");
      p.textContent = a.text;
      box.appendChild(p);
      alertsBox.appendChild(box);
    });
  }

  function renderQR(rawUrl) {
    const url = rawUrl.trim();
    const alerts = checkUrl(url);
    qrBox.textContent = ""; // nunca dejar visible un QR de un enlace anterior

    if (alerts.some((a) => a.level === "error")) {
      setAlerts(alerts);
      return;
    }

    if (typeof QRCode === "undefined") {
      alerts.push({
        level: "error",
        text: "No se cargó el generador de QR. Revisa la conexión a internet o copia el enlace y crea el código con otra herramienta.",
      });
    } else {
      try {
        const size = qrSize();
        new QRCode(qrBox, { text: url, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
      } catch (err) {
        alerts.push({ level: "error", text: "No se pudo generar el código con ese enlace." });
      }
    }
    setAlerts(alerts);
  }

  function openPresent() {
    const url = currentUrl();
    urlField.value = url;
    show("present");
    renderQR(url);
  }

  // ---------- Eventos ----------
  $("goReveal").addEventListener("click", () => {
    fillFingerprint();
    show("reveal");
  });

  ipBtn.addEventListener("click", lookupIp);

  $("restart").addEventListener("click", () => {
    visit++; // descarta peticiones pendientes de la visita anterior
    show("lure");
  });

  $("toPresent").addEventListener("click", openPresent);
  $("toDemo").addEventListener("click", () => show("lure"));
  $("regen").addEventListener("click", () => renderQR(urlField.value));
  urlField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") renderQR(urlField.value);
  });

  $("copyUrl").addEventListener("click", async () => {
    const value = urlField.value.trim();
    try {
      await navigator.clipboard.writeText(value);
      copyStatus.textContent = "Enlace copiado.";
    } catch (err) {
      urlField.select();
      copyStatus.textContent = "No se pudo copiar automáticamente. Selecciona el enlace y cópialo con Ctrl+C.";
    }
  });

  // ---------- Arranque ----------
  ipNote.textContent = IP_NOTE;
  if (location.hash === "#presentar") {
    openPresent();
  } else {
    show("lure");
  }
})();
