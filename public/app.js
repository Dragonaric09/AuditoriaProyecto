/* Demo Quishing · lógica de la demostración.
 *
 * Todo se calcula en el navegador. La única petición que usa datos de conexión
 * es la consulta de IP (botón), que llama a ipwho.is. El resto —huella, ID,
 * y la "simulación de envío"— nunca sale del dispositivo.
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

  // Simulación de envío. El retraso inicial puede acortarse para pruebas con
  // window.__EXFIL_IDLE_MS; en producción son 20 s.
  const EXFIL_IDLE_MS = Number.isFinite(window.__EXFIL_IDLE_MS) ? window.__EXFIL_IDLE_MS : 20000;
  const EXFIL_FROM = 10;        // la cuenta atrás empieza en 10
  const EXFIL_SHOW_STOP_AT = 2; // el botón "detener" aparece a los 8 s

  const $ = (id) => document.getElementById(id);
  const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const views = { lure: $("lure"), reveal: $("reveal"), present: $("present") };
  const fingerprint = $("fingerprint");
  const ipBtn = $("ipBtn");
  const rtcBtn = $("rtcBtn");
  const ipNote = $("ipNote");
  const urlField = $("urlField");
  const alertsBox = $("alerts");
  const qrBox = $("qrbox");
  const copyStatus = $("copyStatus");

  // Incrementa en cada entrada a la revelación. Las respuestas asíncronas de una
  // visita anterior se descartan para no escribir en la pantalla actual.
  let visit = 0;

  // ---------- Hash determinista (sin crypto.subtle, que no existe sobre http://) ----------
  function cyrb53(str, seed) {
    let h1 = 0xdeadbeef ^ (seed || 0);
    let h2 = 0x41c6ce57 ^ (seed || 0);
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
  }

  // ---------- Pantallas ----------
  function show(name) {
    Object.keys(views).forEach((key) => { views[key].hidden = key !== name; });
    window.scrollTo(0, 0);
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

  // ---------- Lectura del user agent ----------
  function parseUA(ua) {
    let m;
    let os = "Desconocido";
    if (/Windows NT 10\.0/.test(ua)) os = "Windows 10 u 11";
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
      device = "Tablet"; deviceIcon = "phone";
    } else if (/Mobi|iPhone|iPod/.test(ua)) {
      device = "Teléfono móvil"; deviceIcon = "phone";
    }
    return { os, browser, device, deviceIcon };
  }

  function timeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (err) { return ""; }
  }

  // ---------- Huellas de alta entropía (todo local) ----------
  function canvasFingerprint() {
    try {
      const c = document.createElement("canvas");
      c.width = 280; c.height = 60;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.textBaseline = "top";
      ctx.font = "16px 'Arial'";
      ctx.fillStyle = "#f60";
      ctx.fillRect(8, 8, 120, 28);
      ctx.fillStyle = "#069";
      ctx.fillText("Quishing 🔒 demo", 12, 14);
      ctx.fillStyle = "rgba(102,200,0,0.7)";
      ctx.fillText("Quishing 🔒 demo", 16, 20);
      return cyrb53(c.toDataURL());
    } catch (err) { return null; }
  }

  function webglInfo() {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return null;
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      return { renderer: String(renderer || ""), vendor: String(vendor || "") };
    } catch (err) { return null; }
  }

  function shortGPU(renderer) {
    if (!renderer) return "";
    const m = /ANGLE \(([^)]+)\)/.exec(renderer);
    let s = m ? m[1] : renderer;
    s = s.replace(/\s*Direct3D.*$/i, "").replace(/\s*vs_\d.*$/i, "").replace(/\s*\(0x[0-9A-Fa-f]+\)/g, "");
    s = s.replace(/^[^,]*,\s*/, ""); // quita el fabricante inicial repetido
    return s.trim().slice(0, 46) || renderer.slice(0, 46);
  }

  function detectFonts() {
    try {
      const baseFonts = ["monospace", "sans-serif", "serif"];
      const testString = "mmmmmmmmmmlli";
      const testSize = "72px";
      const body = document.body;
      const span = document.createElement("span");
      span.setAttribute("aria-hidden", "true");
      span.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden;font-size:" + testSize + ";";
      span.textContent = testString;
      const defW = {}, defH = {};
      for (const b of baseFonts) {
        span.style.fontFamily = b;
        body.appendChild(span);
        defW[b] = span.offsetWidth; defH[b] = span.offsetHeight;
        body.removeChild(span);
      }
      const candidates = [
        "Arial", "Arial Black", "Arial Narrow", "Calibri", "Cambria", "Candara", "Comic Sans MS",
        "Consolas", "Constantia", "Corbel", "Courier New", "Georgia", "Helvetica", "Impact",
        "Lucida Console", "Lucida Sans Unicode", "Palatino Linotype", "Segoe UI", "Segoe Script",
        "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana", "Gill Sans", "Franklin Gothic Medium",
        "MS Gothic", "Menlo", "Monaco", "Optima", "Futura", "Baskerville", "Didot",
        "American Typewriter", "Andale Mono", "Noto Sans", "Roboto", "Ubuntu", "Cantarell", "DejaVu Sans",
      ];
      const detected = [];
      for (const font of candidates) {
        let matched = false;
        for (const b of baseFonts) {
          span.style.fontFamily = "'" + font + "'," + b;
          body.appendChild(span);
          const w = span.offsetWidth, h = span.offsetHeight;
          body.removeChild(span);
          if (w !== defW[b] || h !== defH[b]) { matched = true; break; }
        }
        if (matched) detected.push(font);
      }
      return detected;
    } catch (err) { return []; }
  }

  function audioFingerprint() {
    return new Promise((resolve) => {
      try {
        const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!Ctx) return resolve(null);
        const ctx = new Ctx(1, 5000, 44100);
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = 10000;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -50;
        comp.knee.value = 40;
        comp.ratio.value = 12;
        comp.attack.value = 0;
        comp.release.value = 0.25;
        osc.connect(comp);
        comp.connect(ctx.destination);
        osc.start(0);
        const timer = setTimeout(() => resolve(null), 1500);
        ctx.oncomplete = (e) => {
          clearTimeout(timer);
          try {
            const buf = e.renderedBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += Math.abs(buf[i]);
            resolve(cyrb53(sum.toString()));
          } catch (err) { resolve(null); }
        };
        ctx.startRendering();
      } catch (err) { resolve(null); }
    });
  }

  // ---------- Construcción de filas ----------
  function appendRow(m) {
    const item = document.createElement("div");
    item.className = "data-item reveal-row";
    if (m.id) item.dataset.id = m.id;

    const row = document.createElement("div");
    row.className = "data-row";

    const k = document.createElement("span");
    k.className = "k";
    k.appendChild(icon(m.icon));
    const kl = document.createElement("span");
    kl.className = "k-label";
    kl.textContent = m.label;
    k.appendChild(kl);

    const right = document.createElement("span");
    right.className = "right";
    if (m.high) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "te identifica";
      right.appendChild(badge);
    }
    const v = document.createElement("span");
    v.className = "v" + (m.mono ? " mono" : "");
    v.textContent = m.value;
    right.appendChild(v);

    let riskWrap = null;
    if (m.risk) {
      const help = document.createElement("button");
      help.type = "button";
      help.className = "help-btn";
      help.setAttribute("aria-expanded", "false");
      help.setAttribute("aria-label", "¿Para qué sirve este dato?");
      help.appendChild(icon("help"));
      right.appendChild(help);

      riskWrap = document.createElement("div");
      riskWrap.className = "data-risk";
      riskWrap.hidden = true;
      const p = document.createElement("p");
      p.textContent = m.risk;
      riskWrap.appendChild(p);

      help.addEventListener("click", () => {
        const open = help.getAttribute("aria-expanded") === "true";
        help.setAttribute("aria-expanded", String(!open));
        riskWrap.hidden = open;
      });
    }

    row.appendChild(k);
    row.appendChild(right);
    item.appendChild(row);
    if (riskWrap) item.appendChild(riskWrap);
    fingerprint.appendChild(item);
    updateCount();
  }

  function updateCount() {
    $("dataCount").textContent = String(fingerprint.querySelectorAll(".data-item").length);
  }

  function replaceValue(id, value) {
    const item = fingerprint.querySelector('[data-id="' + id + '"]');
    if (item) item.querySelector(".v").textContent = value;
  }

  // Filas asíncronas (audio, batería) que llegan mientras la revelación progresiva
  // aún se despliega: se encolan para añadirlas al final, no en medio de la lista.
  let renderComplete = false;
  let pendingAsync = [];

  function appendAsync(metric) {
    if (renderComplete) appendRow(metric);
    else pendingAsync.push(metric);
  }

  function renderMetrics(metrics, current) {
    const reduce = reduceMotion();
    let i = 0;
    (function step() {
      if (current !== visit) return;
      if (i >= metrics.length) {
        renderComplete = true;
        const queued = pendingAsync;
        pendingAsync = [];
        queued.forEach(appendRow);
        return;
      }
      appendRow(metrics[i]);
      i++;
      setTimeout(step, reduce ? 0 : 110);
    })();
  }

  // ---------- Nivel de exposición (heurística de la simulación) ----------
  function setExposure(signals) {
    let score = 0;
    if (signals.canvas) score++;
    if (signals.gpu) score++;
    if (signals.fonts >= 8) score++;
    const meter = $("exposure");
    meter.classList.remove("low", "mid", "high");
    let level, note;
    if (score >= 3) {
      level = "Alto"; meter.classList.add("high");
      note = "Tu equipo entrega varias señales únicas (gráfica, fuentes, canvas). Reconocerte sin tu permiso es muy fácil.";
    } else if (score === 2) {
      level = "Medio"; meter.classList.add("mid");
      note = "Tu equipo entrega algunas señales únicas. Combinándolas, se te puede distinguir de la mayoría.";
    } else {
      level = "Bajo"; meter.classList.add("low");
      note = "Tu navegador revela menos señales únicas de lo habitual, pero los datos básicos aún ayudan a perfilarte.";
    }
    $("exposureLevel").textContent = level;
    $("exposureNote").textContent = note + " (Estimación de la simulación, no una medición exacta.)";
  }

  // ---------- Incoherencias / disfraz ----------
  function addIncoh(kind, iconName, text) {
    const el = document.createElement("div");
    el.className = "incoh-item " + kind;
    el.appendChild(icon(iconName));
    const p = document.createElement("span");
    p.textContent = text;
    el.appendChild(p);
    $("incoherences").appendChild(el);
  }

  function buildIncoherences() {
    const box = $("incoherences");
    box.innerHTML = "";
    const flags = [];
    try {
      if (navigator.webdriver) {
        flags.push("Tu navegador está siendo controlado por un programa automático (webdriver): señal típica de un bot.");
      }
      const plat = navigator.platform || "";
      const ua = navigator.userAgent || "";
      if (/Win/i.test(plat) && !/Windows/i.test(ua)) {
        flags.push("Tu plataforma dice Windows pero el identificador del navegador no coincide: algo está alterando tus datos.");
      } else if (/Linux/i.test(plat) && /Windows/i.test(ua)) {
        flags.push("Tu plataforma y tu navegador se contradicen (Linux vs Windows): un indicio de huella falseada.");
      }
      if (!navigator.languages || navigator.languages.length === 0) {
        flags.push("Tu navegador no declara ningún idioma, algo poco común que suelen provocar las herramientas de privacidad.");
      }
    } catch (err) { /* sin incoherencias detectables */ }

    if (flags.length) {
      flags.forEach((f) => addIncoh("flag", "alert", f));
      addIncoh("clean", "info", "Esas contradicciones también son únicas: a veces, intentar esconderse te vuelve más fácil de reconocer.");
    } else {
      addIncoh("clean", "shield", "Tu navegador no oculta ni falsea estos datos, así que tu huella es nítida. Paradójicamente, quien usa herramientas de privacidad a veces se vuelve más único por las incoherencias que generan.");
    }
  }

  // ---------- Afinar el sistema operativo con userAgentData (Chromium) ----------
  function refineOS(current) {
    const uad = navigator.userAgentData;
    if (!uad || typeof uad.getHighEntropyValues !== "function") return;
    uad.getHighEntropyValues(["platformVersion", "bitness"]).then((d) => {
      if (current !== visit) return;
      if (uad.platform === "Windows" && d.platformVersion) {
        const major = parseInt(String(d.platformVersion).split(".")[0], 10);
        const label = major >= 13 ? "Windows 11" : major > 0 ? "Windows 10" : "Windows";
        replaceValue("os", label + (d.bitness ? " (" + d.bitness + " bits)" : ""));
      }
    }).catch(() => {});
  }

  // ---------- Relleno completo de la huella ----------
  function fillFingerprint() {
    const current = ++visit;
    fingerprint.innerHTML = "";
    renderComplete = false;
    pendingAsync = [];
    $("dataCount").textContent = "0";
    $("visitorId").textContent = "· · · · · · · ·";
    resetIp();

    const ua = parseUA(navigator.userAgent || "");
    const conn = navigator.connection;
    const langs = navigator.languages && navigator.languages.length
      ? navigator.languages.join(", ")
      : navigator.language;
    const tz = timeZone();

    const canvas = canvasFingerprint();
    const gl = webglInfo();
    const fonts = detectFonts();

    const metrics = [];
    const add = (icon, label, value, opts) => {
      if (value === "" || value === undefined || value === null) return;
      metrics.push(Object.assign({ icon, label, value: String(value) }, opts || {}));
    };

    add(ua.deviceIcon, "Tipo de dispositivo", ua.device, { risk: "Saber si usas teléfono o computadora ayuda a elegir el engaño: una app falsa, un SMS o un correo." });
    add("monitor", "Sistema operativo", ua.os, { id: "os", risk: "Revela qué sistema y versión usas, para elegir exactamente qué virus o truco funciona en tu equipo." });
    add("globe", "Navegador", ua.browser, { risk: "Indica qué fallos de seguridad podrían aprovecharse en tu navegador." });
    add("globe", "Idioma", langs, { risk: "Sugiere tu país y en qué idioma redactar un engaño creíble." });
    add("clock", "Zona horaria", tz, { risk: "Junto con el idioma, delata tu país y a qué hora sueles conectarte a tu banca." });
    add("monitor", "Pantalla", screen.width + " × " + screen.height + " px", { risk: "Ayuda a distinguir tu equipo de otros." });
    add("monitor", "Ventana", window.innerWidth + " × " + window.innerHeight + " px");
    if (window.devicePixelRatio) add("monitor", "Densidad", window.devicePixelRatio + "×");
    add("cpu", "Núcleos de CPU", navigator.hardwareConcurrency);
    add("cpu", "Memoria aprox.", navigator.deviceMemory ? navigator.deviceMemory + " GB" : "");
    add("phone", "Pantalla táctil", navigator.maxTouchPoints > 0 ? "Sí" : "No");
    if (conn && conn.effectiveType) add("wifi", "Tipo de red", conn.effectiveType, { risk: "Indica si estás en wifi o en datos móviles." });
    add("clock", "Hora exacta de la visita", new Date().toLocaleString());
    if (document.referrer) add("globe", "Página de origen", document.referrer);

    // Alta entropía: lo que de verdad te identifica
    add("fingerprint", "Huella de canvas", canvas ? canvas.slice(0, 16) : "(no disponible)", {
      mono: true, high: !!canvas,
      risk: "Tu equipo dibuja una imagen invisible de forma única por su gráfica y sus fuentes. Te reconoce aunque cambies de red o borres cookies.",
    });
    if (gl && gl.renderer) {
      add("chip", "Tarjeta gráfica", shortGPU(gl.renderer), {
        high: true,
        risk: "Identifica el modelo exacto de tu hardware, un dato muy difícil de ocultar.",
      });
    }
    add("type", "Fuentes detectadas", fonts.length + (fonts.length === 1 ? " fuente" : " fuentes"), {
      high: fonts.length >= 8,
      risk: "Las fuentes instaladas delatan tu sistema operativo y qué programas tienes (Office, diseño, etc.).",
    });

    renderMetrics(metrics, current);

    // Identificador combinado (parte síncrona)
    const idSeed = [
      navigator.userAgent, langs, tz,
      screen.width + "x" + screen.height, window.devicePixelRatio,
      navigator.hardwareConcurrency, navigator.deviceMemory,
      canvas, gl && gl.renderer, fonts.join(","),
    ].join("§");
    $("visitorId").textContent = formatId(cyrb53(idSeed));

    setExposure({ canvas: !!canvas, gpu: !!(gl && gl.renderer), fonts: fonts.length });
    buildIncoherences();
    refineOS(current);

    // Asíncronos: audio y batería
    audioFingerprint().then((h) => {
      if (current !== visit || !h) return;
      appendAsync({ icon: "activity", label: "Huella de audio", value: h.slice(0, 16), mono: true, high: true,
        risk: "El procesador de audio de tu equipo produce un patrón propio que también te identifica." });
    });

    if (typeof navigator.getBattery === "function") {
      navigator.getBattery().then((b) => {
        if (current !== visit) return;
        appendAsync({ icon: "battery", label: "Batería",
          value: Math.round(b.level * 100) + "%" + (b.charging ? " (cargando)" : "") });
      }).catch(() => {});
    }
  }

  function formatId(hex) {
    return hex.toUpperCase().replace(/(.{4})/g, "$1 ").trim();
  }

  // ---------- Consulta de IP pública (externa, bajo demanda) ----------
  function resetIp() {
    ipBtn.hidden = false;
    ipBtn.disabled = false;
    ipBtn.textContent = "Consultar mi dirección IP";
    rtcBtn.hidden = false;
    rtcBtn.disabled = false;
    rtcBtn.textContent = "Revelar mi IP en la red local";
    ipNote.textContent = IP_NOTE;
  }

  function lookupIp() {
    const current = visit;
    ipBtn.disabled = true;
    ipBtn.textContent = "Consultando…";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IP_TIMEOUT_MS);

    fetch(IP_ENDPOINT, { signal: controller.signal, cache: "no-store", referrerPolicy: "no-referrer" })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((d) => {
        if (current !== visit) return;
        if (!d || d.success === false) throw new Error("sin datos");
        appendRow({ icon: "pin", label: "Dirección IP pública", value: d.ip, high: true,
          risk: "Tu IP revela tu proveedor y tu zona geográfica, y permite rastrear tu actividad." });
        appendRow({ icon: "pin", label: "Ubicación aprox.", value: [d.city, d.region, d.country].filter(Boolean).join(", ") });
        if (d.connection && d.connection.isp) appendRow({ icon: "globe", label: "Proveedor de internet", value: d.connection.isp });
        ipBtn.hidden = true;
        ipNote.textContent = "Listo. Un atacante real obtiene esto solo con que abras su página.";
      })
      .catch(() => {
        if (current !== visit) return;
        ipBtn.disabled = false;
        ipBtn.textContent = "Reintentar consulta de IP";
        ipNote.textContent = "No se pudo consultar. Aun así, cualquier sitio que visites recibe tu IP con cada petición.";
      })
      .finally(() => clearTimeout(timer));
  }

  // ---------- IP de red local por WebRTC (sin servidores externos) ----------
  function lookupLocalIp() {
    const current = visit;
    rtcBtn.disabled = true;
    rtcBtn.textContent = "Buscando…";
    if (!window.RTCPeerConnection) {
      rtcBtn.hidden = true;
      appendRow({ icon: "net", label: "IP de red local", value: "No disponible en este navegador" });
      return;
    }
    const found = new Set();
    let settled = false;
    const finish = () => {
      if (settled || current !== visit) return;
      settled = true;
      try { pc.close(); } catch (e) {}
      rtcBtn.hidden = true;
      if (found.size === 0) {
        appendRow({ icon: "net", label: "IP de red local", value: "Protegida por tu navegador (mDNS)",
          risk: "Tu navegador oculta tu IP local tras un nombre .local. Sin esa protección, una web vería tu dirección dentro de tu red." });
      } else {
        [...found].forEach((ip) => appendRow({ icon: "net", label: "IP de red local", value: ip, high: /^\d/.test(ip),
          risk: "Expone tu dirección dentro de tu red (tu router, otros equipos). Útil para ataques en la misma red." }));
      }
    };

    let pc;
    try { pc = new RTCPeerConnection(); } catch (e) { rtcBtn.hidden = true; return; }
    try { pc.createDataChannel("x"); } catch (e) {}
    pc.onicecandidate = (e) => {
      if (!e.candidate) return finish();
      const cand = e.candidate.candidate || "";
      const m = /candidate:\S+ \d+ \S+ \d+ (\S+) /.exec(cand);
      if (m && m[1] && !/^0\.0\.0\.0/.test(m[1])) found.add(m[1]);
    };
    pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => finish());
    setTimeout(finish, 1500);
  }

  // ========================= SIMULACIÓN DE ENVÍO =========================
  // ---------- Alarma sonora al pulsar "detener" (generada en el navegador) ----------
  // Sin archivos ni red: una sirena sintetizada con Web Audio + la voz del sistema.
  // Debe iniciarse dentro del gesto del usuario (el clic), o el navegador lo bloquea.
  let alarmCtx = null;
  let alarmOsc = null;
  let alarmVoiceTimer = null;

  function pickSpanishVoice() {
    const voices = speechSynthesis.getVoices();
    return voices.find((v) => /^es[-_]/i.test(v.lang)) || null;
  }

  function speakAlert() {
    alarmVoiceTimer = null;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
    const doSpeak = () => {
      try {
        const u = new SpeechSynthesisUtterance("Alerta, peligro. Alerta, peligro, meeeeeeeeeel, JOHHNN APURA NO VAMOS A TERMINAR.");
        u.lang = "es-ES";
        u.rate = 0.95;
        u.pitch = 0.8;
        u.volume = 1;
        const voice = pickSpanishVoice();
        if (voice) u.voice = voice;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch (err) { /* sin voz: queda la sirena */ }
    };
    // En algunos navegadores las voces cargan con retraso: esperamos un instante.
    if (speechSynthesis.getVoices().length) {
      doSpeak();
    } else {
      let done = false;
      const once = () => { if (!done) { done = true; doSpeak(); } };
      speechSynthesis.addEventListener?.("voiceschanged", once, { once: true });
      setTimeout(once, 600);
    }
  }

  function playDangerAlarm() {
    stopDangerAlarm();

    // 1) Sirena: la frecuencia sube y baja cuatro veces (≈2.4 s).
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        if (!alarmCtx) alarmCtx = new Ctx();
        if (alarmCtx.state === "suspended") alarmCtx.resume();
        const t0 = alarmCtx.currentTime + 0.05;
        const dur = 2.4;
        const osc = alarmCtx.createOscillator();
        const filter = alarmCtx.createBiquadFilter();
        const gain = alarmCtx.createGain();
        osc.type = "square";
        filter.type = "lowpass";
        filter.frequency.value = 1800;
        osc.frequency.setValueAtTime(600, t0);
        for (let i = 0; i < 4; i++) {
          const s = t0 + i * 0.6;
          osc.frequency.linearRampToValueAtTime(1200, s + 0.3);
          osc.frequency.linearRampToValueAtTime(600, s + 0.6);
        }
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.08);
        gain.gain.setValueAtTime(0.2, t0 + dur - 0.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(filter).connect(gain).connect(alarmCtx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
        alarmOsc = osc;
      }
    } catch (err) { /* sin audio: la alerta visual sigue */ }

    // 2) Voz: "Alerta, peligro", justo después de la sirena.
    alarmVoiceTimer = setTimeout(speakAlert, 2400);
  }

  function stopDangerAlarm() {
    clearTimeout(alarmVoiceTimer);
    alarmVoiceTimer = null;
    if (alarmOsc) {
      try { alarmOsc.stop(); } catch (err) { /* ya terminó */ }
      alarmOsc = null;
    }
    if ("speechSynthesis" in window) {
      try { speechSynthesis.cancel(); } catch (err) { /* nada que cancelar */ }
    }
  }

  const exfil = $("exfil");
  let exfilArmTimer = null;
  let exfilInterval = null;
  let exfilDone = false;

  let exfilReturnInterval = null;
  const RETURN_AFTER_S = 10; // tras mostrar el mapa, vuelve a la información en 10 s

  function clearExfilTimers() {
    clearTimeout(exfilArmTimer);
    clearInterval(exfilInterval);
    clearInterval(exfilReturnInterval);
    exfilArmTimer = null;
    exfilInterval = null;
    exfilReturnInterval = null;
  }

  // Cuenta regresiva en la pantalla del mapa: al llegar a cero, vuelve a la información.
  function startReturnCountdown() {
    let left = RETURN_AFTER_S;
    const label = $("exfilAuto");
    const paint = () => {
      label.textContent = "Te llevamos de vuelta a tus datos en " + left + " s…";
    };
    paint();
    exfilReturnInterval = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(exfilReturnInterval);
        exfilReturnInterval = null;
        closeExfil();
        return;
      }
      paint();
    }, 1000);
  }

  function armExfil() {
    clearExfilTimers();
    if (exfilDone) return;
    exfilArmTimer = setTimeout(startExfil, EXFIL_IDLE_MS);
  }

  function updateExfilBar(n) {
    $("exfilBar").style.width = Math.max(0, (n / EXFIL_FROM) * 100) + "%";
  }

  function startExfil() {
    clearInterval(exfilInterval);
    $("exfilCountView").hidden = false;
    $("exfilExplainView").hidden = true;
    $("exfilCard").classList.add("alarm");
    $("exfilStop").hidden = true;
    exfil.hidden = false;
    exfil.focus({ preventScroll: true });

    let n = EXFIL_FROM;
    $("exfilCount").textContent = String(n);
    updateExfilBar(n);

    exfilInterval = setInterval(() => {
      n--;
      if (n <= EXFIL_SHOW_STOP_AT && $("exfilStop").hidden) {
        $("exfilStop").hidden = false;
        $("exfilStop").focus({ preventScroll: true });
      }
      if (n <= 0) {
        clearInterval(exfilInterval);
        $("exfilCount").textContent = "0";
        updateExfilBar(0);
        revealExfilExplain(false);
        return;
      }
      $("exfilCount").textContent = String(n);
      updateExfilBar(n);
    }, 1000);
  }

  function revealExfilExplain(stopped) {
    exfilDone = true;
    clearExfilTimers();
    $("exfilCard").classList.remove("alarm");
    $("exfilCountView").hidden = true;
    $("exfilExplainView").hidden = false;

    $("exfilExplainTitle").textContent = stopped ? "Detuviste el envío… ¿o no?" : "Se acabó el tiempo";
    $("exfilExplainText").textContent = stopped
      ? "Tocaste el botón para detenerlo. En un ataque real, ese mismo botón podría hacer lo contrario de lo que promete."
      : "No tocaste nada y el contador llegó a cero. En un ataque real, tus datos ya estarían en manos del atacante.";
    $("exfilBack").focus({ preventScroll: true });
    startReturnCountdown();
  }

  function closeExfil() {
    exfil.hidden = true;
    clearExfilTimers();
    stopDangerAlarm();
    show("reveal");
  }

  // Salir en cualquier momento: no vuelve a disparar la simulación en esta visita.
  function exitExfil() {
    exfilDone = true;
    closeExfil();
  }

  // ---------- Modo expositor (QR) ----------
  function currentUrl() { return location.origin + location.pathname; }

  function qrSize() {
    const available = Math.min(window.innerWidth, 520) - 140;
    return Math.round(Math.min(QR_MAX, Math.max(QR_MIN, available)));
  }

  function checkUrl(url) {
    const alerts = [];
    if (location.protocol === "file:") {
      alerts.push({ level: "warn", text: "Estás abriendo la demo como archivo. Para que el QR funcione, ejecuta «npm start» y abre http://localhost:3000/#presentar." });
    }
    let parsed = null;
    try { parsed = new URL(url); } catch (err) { parsed = null; }
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      alerts.push({ level: "error", text: "El enlace no es válido. Debe empezar con http:// o https://, por ejemplo http://192.168.1.20:3000." });
      return alerts;
    }
    if (LOCAL_HOSTNAMES.includes(parsed.hostname)) {
      alerts.push({ level: "warn", text: "Este enlace solo abre en esta computadora. Para que la audiencia lo escanee con su teléfono, usa la dirección de red que muestra la consola del servidor (por ejemplo http://192.168.1.20:3000)." });
    } else if (parsed.protocol === "http:") {
      alerts.push({ level: "info", text: "Sin HTTPS, algunos navegadores muestran advertencias. Úsalo dentro de la red del aula o publica la app con HTTPS." });
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
    qrBox.textContent = "";
    if (alerts.some((a) => a.level === "error")) { setAlerts(alerts); return; }
    if (typeof QRCode === "undefined") {
      alerts.push({ level: "error", text: "No se cargó el generador de QR. Revisa la conexión a internet o copia el enlace y crea el código con otra herramienta." });
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
    clearExfilTimers();
    const url = currentUrl();
    urlField.value = url;
    show("present");
    renderQR(url);
  }

  // ---------- Eventos ----------
  $("goReveal").addEventListener("click", () => {
    exfilDone = false;
    fillFingerprint();
    show("reveal");
    armExfil();
  });

  ipBtn.addEventListener("click", lookupIp);
  rtcBtn.addEventListener("click", lookupLocalIp);

  $("incognitoBtn").addEventListener("click", function () {
    const open = this.getAttribute("aria-expanded") === "true";
    this.setAttribute("aria-expanded", String(!open));
    $("incognitoNote").hidden = open;
  });

  $("restart").addEventListener("click", () => {
    visit++;
    clearExfilTimers();
    stopDangerAlarm();
    show("lure");
  });

  // El clic del usuario habilita el audio: la alarma suena solo al pulsar "detener".
  $("exfilStop").addEventListener("click", () => {
    playDangerAlarm();
    revealExfilExplain(true);
  });
  $("exfilBack").addEventListener("click", closeExfil);
  $("exfilExit").addEventListener("click", exitExfil);

  $("toPresent").addEventListener("click", openPresent);
  $("toDemo").addEventListener("click", () => show("lure"));
  $("regen").addEventListener("click", () => renderQR(urlField.value));
  urlField.addEventListener("keydown", (e) => { if (e.key === "Enter") renderQR(urlField.value); });

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
