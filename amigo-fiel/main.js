(function () {
  "use strict";

  var data = window.__BRAND__ || {};
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fineHover = matchMedia("(hover: hover) and (pointer: fine)").matches;

  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };
  var escHTML = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }
  function svgUse(id) { return '<svg aria-hidden="true"><use href="#' + id + '"/></svg>'; }

  var PHONE = (data.contact && data.contact.phone) || "600 000 000";
  var PHONE_HREF = (data.contact && data.contact.phoneHref) || "tel:+34600000000";

  // POST JSON con tiempo máximo; devuelve null si falla (nunca rompe la interfaz).
  function postJSON(url, body, timeoutMs) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 30000) : null;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (t) clearTimeout(t);
      var ct = r.headers.get("content-type") || "";
      if (ct.indexOf("json") === -1) return null;
      return r.json();
    }).catch(function () { if (t) clearTimeout(t); return null; });
  }

  /* =========================================================
     Splash + arranque
     ========================================================= */
  function initSplash() {
    var splash = $(".splash");
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      if (splash) splash.classList.add("is-done");
      document.documentElement.classList.add("is-ready");
      setTimeout(function () { if (splash && splash.parentNode) splash.parentNode.removeChild(splash); }, 900);
    }
    if (document.readyState === "complete") setTimeout(finish, 650);
    else window.addEventListener("load", function () { setTimeout(finish, 350); });
    setTimeout(finish, 1800); // red de seguridad JS (la CSS actúa a los 2,6 s)
  }

  /* =========================================================
     Navegación
     ========================================================= */
  function initNav() {
    var nav = $(".nav");
    var burger = $(".nav-burger");
    var menu = $("#mobile-menu");
    var lastY = window.scrollY;
    function onScroll() {
      var y = window.scrollY;
      nav.classList.toggle("is-scrolled", y > 24);
      var menuOpen = burger && burger.getAttribute("aria-expanded") === "true";
      if (!menuOpen) nav.classList.toggle("is-hidden", y > 600 && y > lastY + 4);
      if (y < lastY - 4) nav.classList.remove("is-hidden");
      lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    function setMenu(open) {
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      menu.hidden = !open;
      if (open) nav.classList.add("is-scrolled");
    }
    if (burger && menu) {
      burger.addEventListener("click", function () { setMenu(burger.getAttribute("aria-expanded") !== "true"); });
      $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
    }
  }

  /* =========================================================
     Apariciones al hacer scroll
     ========================================================= */
  function initReveals() {
    var els = $$(".reveal, .reveal-img");
    // escalonado entre hermanos
    els.forEach(function (el) {
      var parent = el.parentElement;
      if (!parent) return;
      var sibs = Array.prototype.filter.call(parent.children, function (c) { return c.classList.contains("reveal"); });
      var i = sibs.indexOf(el);
      if (i > 0) el.style.setProperty("--d", Math.min(i * 0.08, 0.5) + "s");
    });
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (el) { io.observe(el); });
    // red de seguridad: nada se queda invisible
    setTimeout(function () {
      els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("is-in");
      });
    }, 2500);
  }

  /* =========================================================
     Contadores
     ========================================================= */
  function initCounters() {
    var els = $$("[data-count]");
    var fmt = function (v, el) {
      var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var s = v.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: true });
      if (el.getAttribute("data-format") === "k" && v >= 1000) s = Math.round(v).toLocaleString("es-ES").replace(/\s/g, ".");
      return s + (el.getAttribute("data-suffix") || "");
    };
    function run(el) {
      var to = parseFloat(el.getAttribute("data-count"));
      var dur = 1600, t0 = performance.now();
      (function tick(now) {
        var p = Math.min((now - t0) / dur, 1);
        var e = 1 - Math.pow(1 - p, 4);
        el.textContent = fmt(to * e, el);
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* =========================================================
     Foco de luz en el hero + tilt + botones magnéticos
     ========================================================= */
  function initHeroSpot() {
    var hero = $(".hero");
    if (!hero || !fineHover) return;
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      hero.style.setProperty("--spot-x", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
      hero.style.setProperty("--spot-y", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    });
  }

  function initTilt() {
    if (!fineHover) return;
    $$(".tilt").forEach(function (card) {
      var raf = 0;
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () {
          card.style.setProperty("--hx", (px * 100).toFixed(1) + "%");
          card.style.setProperty("--hy", (py * 100).toFixed(1) + "%");
          card.style.transform = "perspective(900px) rotateX(" + ((0.5 - py) * 6).toFixed(2) + "deg) rotateY(" + ((px - 0.5) * 6).toFixed(2) + "deg) translateY(-4px)";
        });
      });
      card.addEventListener("pointerleave", function () { cancelAnimationFrame(raf); card.style.transform = ""; });
    });
  }

  function initMagnetic() {
    if (!fineHover) return;
    $$(".magnetic").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        b.style.setProperty("--mx", x + "px");
        b.style.setProperty("--my", y + "px");
        b.style.setProperty("--bx", ((x - r.width / 2) * 0.18).toFixed(1) + "px");
        b.style.setProperty("--by", ((y - r.height / 2) * 0.25).toFixed(1) + "px");
      });
      b.addEventListener("pointerleave", function () { b.style.setProperty("--bx", "0px"); b.style.setProperty("--by", "0px"); });
    });
  }

  /* =========================================================
     Pestañas de etapas
     ========================================================= */
  function initStages() {
    var tabs = $$(".stage-tabs [role=tab]");
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var p = document.getElementById(t.getAttribute("aria-controls"));
        if (p) { p.hidden = !on; p.classList.toggle("is-active", on); }
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!n) return;
        var next = tabs[(i + n + tabs.length) % tabs.length];
        select(next); next.focus();
      });
    });
  }

  /* =========================================================
     Animaciones con GSAP (si está disponible)
     ========================================================= */
  function initGsap() {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    // Parallax suave de la foto del hero
    var heroImg = $(".hero-photo img");
    if (heroImg) {
      gsap.fromTo(heroImg, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    }

    // Línea de "cómo funciona" que se dibuja
    var path = $(".steps-line path");
    if (path && path.getTotalLength) {
      var len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      gsap.to(path, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: ".steps-wrap", start: "top 80%", end: "bottom 60%", scrub: true } });
    }

    // Galería horizontal anclada (solo escritorio)
    var mm = gsap.matchMedia();
    mm.add("(min-width: 960px)", function () {
      var section = $(".gallery");
      var track = $(".gallery-track");
      if (!section || !track) return;
      section.classList.add("is-pinned");
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth + 40); };
      var tween = gsap.to(track, {
        x: function () { return -dist(); }, ease: "none",
        scrollTrigger: { trigger: section, start: "top top", end: function () { return "+=" + dist(); }, scrub: 0.6, pin: ".gallery-pin", invalidateOnRefresh: true, anticipatePin: 1 }
      });
      return function () { section.classList.remove("is-pinned"); tween.kill(); gsap.set(track, { clearProps: "x" }); };
    });

    // Gigante del pie con desplazamiento lateral
    var giant = $(".footer-giant");
    if (giant) gsap.fromTo(giant, { xPercent: 6 }, { xPercent: -6, ease: "none", scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true } });

    // Las imágenes cargan tarde: recalcular posiciones
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  }

  /* =========================================================
     Formulario de cita
     ========================================================= */
  function initAppointment() {
    var form = $("[data-appt]");
    if (!form) return;
    var err = $(".p-error", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      var fd = new FormData(form);
      var tutor = String(fd.get("tutor") || "").trim();
      var tel = String(fd.get("telefono") || "").trim();
      var email = String(fd.get("email") || "").trim();
      var msg = "";
      if (!tutor) msg = "Dinos tu nombre, por favor.";
      else if (tel.replace(/\D/g, "").length < 9) msg = "Revisa el teléfono: necesitamos al menos 9 cifras para llamarte.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) msg = "Revisa el email, parece que falta algo.";
      else if (!fd.get("consent")) msg = "Necesitamos tu permiso para usar estos datos y gestionar la cita.";
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      var btn = $("button[type=submit]", form);
      btn.disabled = true; btn.innerHTML = "Enviando…";
      postJSON("lead.php", {
        tipo: "cita", tutor: tutor, telefono: tel, email: email, consent: true,
        mascota: { nombre: String(fd.get("mascota") || "") },
        cita: { motivo: fd.get("motivo"), preferencia: fd.get("preferencia"), comentarios: String(fd.get("comentarios") || "") }
      }, 15000).then(function (res) {
        if (res && res.ok) {
          $(".appt-ok", form).hidden = false;
        } else {
          btn.disabled = false; btn.innerHTML = "Solicitar cita " + svgUse("i-arrow");
          err.innerHTML = "No hemos podido enviar la solicitud ahora mismo. Llámanos al <a href=\"" + PHONE_HREF + "\">" + escHTML(PHONE) + "</a> y te damos cita al momento.";
          err.hidden = false;
        }
      });
    });
  }

  /* =========================================================
     Asistente de chat «Fiel»
     ========================================================= */
  var URGENT_RE = new RegExp([
    "venen", "envenen", "intoxic", "raticida", "matarratas", "anticongelante", "lejia",
    "se ha comido (un |una |el |la |unos |unas )?(chocolate|uvas|pasas|xilitol|chicle|cebolla|ajo|veneno|pastilla|medicamento|ibuprofeno|paracetamol|hueso|calcetin|juguete|pila)",
    "comido (veneno|raticida|chocolate|uvas|pasas|xilitol|ibuprofeno|paracetamol)",
    "no respira", "no puede respirar", "cuesta respirar", "dificultad (para|al) respirar", "respira (mal|con dificultad|muy rapido)", "se ahoga", "ahogando", "asfixi", "lengua (morada|azul)",
    "convulsi", "ataque epilep", "epilepsia", "espasmos",
    "atropell", "le ha pillado un coche", "golpe con un coche", "caido de (un|una|el|la) (balcon|ventana|altura|terraza)",
    "sangra mucho", "sangrando mucho", "hemorragia", "mucha sangre",
    "inconsciente", "no reacciona", "desmay", "colaps",
    "golpe de calor", "barriga hinchada", "abdomen hinchado", "tripa hinchada", "torsion", "intenta vomitar y no", "arcadas sin vomitar",
    "no puede orinar", "no orina", "no hace pis",
    "procesionaria", "picadura de (serpiente|vibora)", "mordedura de (serpiente|vibora)", "sapo",
    "fractura", "hueso roto", "quemadura", "encias (palidas|blancas|azules|moradas)",
    "parto.*(horas|complic|atascad)", "no puede levantarse", "paralisis", "no mueve las patas"
  ].join("|"));
  function normalize(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  function renderRich(text) {
    var lines = escHTML(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>").split(/\n+/);
    var html = "", inList = false;
    lines.forEach(function (l) {
      var m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
      if (m) { if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + m[1] + "</li>"; }
      else { if (inList) { html += "</ul>"; inList = false; } if (l.trim()) html += "<p>" + l + "</p>"; }
    });
    if (inList) html += "</ul>";
    return html;
  }

  function initChat() {
    var panel = $("#chat-panel");
    var fab = $(".chat-fab");
    var log = $(".chat-log", panel);
    var form = $(".chat-form", panel);
    var input = $("#chat-input");
    var suggest = $(".chat-suggest", panel);
    var history = [];
    var busy = false;

    function open() {
      panel.hidden = false;
      fab.setAttribute("aria-expanded", "true");
      setTimeout(function () { input.focus({ preventScroll: true }); }, 60);
    }
    function close() {
      panel.hidden = true;
      fab.setAttribute("aria-expanded", "false");
      fab.focus({ preventScroll: true });
    }
    $$("[data-open-chat]").forEach(function (b) { b.addEventListener("click", function () { panel.hidden ? open() : close(); }); });
    $(".chat-close", panel).addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });

    function scrollEnd() { log.scrollTop = log.scrollHeight; }
    function add(html, cls) {
      var d = document.createElement("div");
      d.className = "msg " + cls;
      d.innerHTML = html;
      log.appendChild(d);
      scrollEnd();
      return d;
    }
    function ctas(extra) {
      return '<div class="msg-cta"><a href="#contacto" data-close-chat>' + svgUse("i-cal") + " Pedir cita</a>" +
        '<a class="alt" href="' + PHONE_HREF + '">' + svgUse("i-phone") + " Llamar</a>" + (extra || "") + "</div>";
    }
    log.addEventListener("click", function (e) {
      var a = e.target.closest("[data-close-chat]");
      if (a && window.innerWidth < 720) close();
    });

    function urgentMsg() {
      add("<p><strong>⚠️ Esto puede ser una urgencia.</strong> No esperes a que te responda: llama ahora a la clínica o acude directamente. Atendemos urgencias 24 h.</p>" +
        '<p>Mientras tanto, mantén a tu mascota tranquila y no le des comida, agua ni medicamentos sin indicación veterinaria.</p>' +
        '<div class="msg-cta"><a href="' + PHONE_HREF + '">' + svgUse("i-phone") + " Llamar: " + escHTML(PHONE) + '</a><a class="alt" href="#contacto" data-close-chat>' + svgUse("i-pin") + " Cómo llegar</a></div>", "bot urgent");
    }

    function send(text) {
      text = String(text || "").trim().slice(0, 500);
      if (!text || busy) return;
      busy = true;
      suggest.hidden = true;
      add("<p>" + escHTML(text) + "</p>", "user");
      var isUrgent = URGENT_RE.test(normalize(text));
      if (isUrgent) urgentMsg();
      var typing = add('<span class="typing" aria-label="Escribiendo"><i></i><i></i><i></i></span>', "bot");
      var sentHistory = history.slice(-8);
      history.push({ role: "user", text: text });
      postJSON("asistente-ia.php", { message: text, history: sentHistory }, 35000).then(function (res) {
        typing.remove();
        var reply = res && res.reply ? String(res.reply) : "";
        if (!reply) {
          add("<p>Ahora mismo no puedo responderte. Si es algo urgente, llama a la clínica; si no, pide cita y te atendemos encantados.</p>" + ctas(), "bot");
        } else {
          history.push({ role: "model", text: reply });
          var wantsCta = /cita|consulta|clinica|clínica|veterinari|llama/i.test(reply) && history.length >= 2;
          add(renderRich(reply) + (wantsCta && !isUrgent ? ctas() : ""), "bot");
        }
        busy = false;
      });
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value; input.value = ""; send(v); });
    $$("button", suggest).forEach(function (b) { b.addEventListener("click", function () { send(b.textContent); }); });
  }

  /* =========================================================
     Planificador de cuidados
     ========================================================= */
  var MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { var x = new Date(d.getTime()); var day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); var last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(day, last)); return x; }
  function parseDate(s) {
    if (!s || typeof s !== "string") return null;
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d) ? null : d;
  }
  function fmtDate(d) { return d ? d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() : "—"; }
  function eur(n) { return Math.round(n).toLocaleString("es-ES") + " €"; }
  function maxDate(a, b) { return a > b ? a : b; }

  var VAC_LABEL = {
    polivalente_perro: "Polivalente (moquillo, parvovirus, hepatitis, leptospirosis)",
    rabia: "Rabia",
    leishmania: "Leishmaniosis",
    tos_perreras: "Tos de las perreras",
    trivalente_gato: "Trivalente felina (panleucopenia, rinotraqueitis, calicivirus)",
    leucemia_felina: "Leucemia felina (FeLV)"
  };
  // Clasificación de respaldo si la IA no normaliza el tipo
  function guessVacType(name) {
    var n = normalize(name || "");
    if (/rabi|antirrab/.test(n)) return "rabia";
    if (/leish|canileish|letifend/.test(n)) return "leishmania";
    if (/tos|bordetel|kc\b|pneumodog|parainfluenza intranasal/.test(n)) return "tos_perreras";
    if (/felv|leucemia|leucogen/.test(n)) return "leucemia_felina";
    if (/trivalen|felocell|rcp|rinotraq|calici|panleuc|tricat|feligen/.test(n)) return "trivalente_gato";
    if (/polival|dhpp|dhp|moquillo|parvo|hepatitis|lepto|canigen|nobivac|eurican|vanguard|puppy|tetra|penta|hexa|l4/.test(n)) return "polivalente_perro";
    return "otra";
  }

  function buildPlan(p, x) {
    var P = data.prices || {};
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var end = addMonths(today, 12);
    var isDog = p.especie === "perro";
    var life = p.vida || [];
    var has = function (v) { return life.indexOf(v) !== -1; };

    // Edad: si la cartilla trae la fecha de nacimiento, manda la cartilla.
    var birth = x && x.mascota && parseDate(x.mascota.fecha_nacimiento);
    var ageMonths = p.ageMonths;
    if (birth && birth < today) ageMonths = (today - birth) / (1000 * 60 * 60 * 24 * 30.44);
    if (!birth) birth = addDays(today, -Math.round(ageMonths * 30.44));
    var ageYears = ageMonths / 12;
    var ageWeeks = ageMonths * 4.345;
    var peso = p.peso || (x && x.mascota && x.mascota.peso_kg) || 0;

    var stage = ageMonths < 12 ? "cachorro"
      : (isDog ? (ageYears >= 7 || (peso >= 25 && ageYears >= 6)) : ageYears >= 10) ? "senior" : "adulto";
    var wf = !peso ? 1 : peso < 10 ? 0.8 : peso < 25 ? 1 : peso < 40 ? 1.25 : 1.5;

    var items = [];   // { date|null, kind, title, detail, cost, cat, late }
    var routine = []; // { title, detail }
    var vacs = (x && Array.isArray(x.vacunas)) ? x.vacunas.map(function (v) {
      var t = v.tipo && VAC_LABEL[v.tipo] ? v.tipo : guessVacType(v.nombre);
      return { tipo: t, fecha: parseDate(v.fecha), proxima: parseDate(v.proxima) };
    }) : [];
    var hasDoc = !!(x && (vacs.length || (x.desparasitaciones || []).length));
    function dosesOf(t) { return vacs.filter(function (v) { return v.tipo === t; }); }
    function lastOf(t) {
      var d = dosesOf(t).filter(function (v) { return v.fecha; }).sort(function (a, b) { return b.fecha - a.fecha; });
      return d[0] || null;
    }
    function push(it) {
      if (it.date && it.date > end) return;
      if (it.date && it.date < today) { it.late = true; it.date = addDays(today, 7); }
      items.push(it);
    }
    // Vacuna anual: usa la cartilla si hay datos; si no, la pregunta rápida.
    function annual(t, cost, detail) {
      var last = lastOf(t);
      var nextDoc = dosesOf(t).filter(function (v) { return v.proxima; }).sort(function (a, b) { return b.proxima - a.proxima; })[0];
      var due = null, late = false, d = detail;
      if (nextDoc) due = nextDoc.proxima;
      else if (last) due = addMonths(last.fecha, 12);
      else if (p.vacunasAlDia === "si" && !hasDoc) { due = null; d = detail + " · Fecha según su cartilla: tráela a la consulta."; }
      else { due = addDays(today, 14); d = detail + " · No consta la última dosis: lo revisamos en la primera visita."; }
      if (due && due < today) late = true;
      push({ date: due, kind: "vac", title: "Vacuna: " + VAC_LABEL[t], detail: d, cost: cost, cat: "vacunas", late: late });
    }
    // Serie de primovacunación (cachorros / gatitos)
    function series(t, weeks, cost, detail) {
      var given = dosesOf(t).length;
      if (!given && p.vacunasAlDia === "si" && !hasDoc) given = weeks.filter(function (w) { return w <= ageWeeks; }).length;
      var next = null;
      for (var i = given; i < weeks.length; i++) {
        var target = addDays(birth, weeks[i] * 7);
        var date = next ? maxDate(target, addDays(next, 21)) : maxDate(target, addDays(today, 7));
        push({ date: date, kind: "vac", title: "Vacuna: " + VAC_LABEL[t] + " · dosis " + (i + 1) + " de " + weeks.length, detail: detail, cost: cost, cat: "vacunas" });
        next = date;
      }
      return next;
    }

    var zone = data.leishmaniaZone;
    if (isDog) {
      if (ageWeeks < 18) {
        var lastPuppy = series("polivalente_perro", [7, 11, 15], P.vacPolivalente, "Primovacunación del cachorro. El refuerzo será anual.");
        if (!lastOf("rabia")) push({ date: maxDate(addDays(birth, 16 * 7), addDays(today, 7)), kind: "vac", title: "Vacuna: Rabia", detail: "A partir de las 12 semanas. Obligatoria; la periodicidad del refuerzo depende de tu comunidad autónoma.", cost: P.vacRabia, cat: "vacunas" });
        if (lastPuppy) push({ date: addMonths(lastPuppy, 12), kind: "vac", title: "Refuerzo anual de la polivalente", detail: "Un año después de la última dosis de cachorro.", cost: P.vacPolivalente, cat: "vacunas" });
      } else {
        annual("polivalente_perro", P.vacPolivalente, "Refuerzo anual.");
        annual("rabia", P.vacRabia, "Obligatoria; la periodicidad depende de tu comunidad autónoma.");
      }
      if (zone) {
        var leishFrom = maxDate(addMonths(birth, 6), addDays(today, 10));
        var lastL = lastOf("leishmania");
        if (lastL) annual("leishmania", P.vacLeish + P.testLeish, "Test rápido + refuerzo anual.");
        else if (leishFrom <= end) {
          push({ date: leishFrom, kind: "vac", title: "Test y vacuna de leishmaniosis", detail: "Recomendada en zona mediterránea a partir de los 6 meses, siempre con test previo negativo.", cost: P.vacLeish + P.testLeish, cat: "vacunas" });
        }
      }
      if (has("guarderia") || has("viaja")) {
        var lastT = lastOf("tos_perreras");
        if (lastT) annual("tos_perreras", P.vacTos, "Recomendada por convivir con otros perros.");
        else push({ date: maxDate(addDays(birth, 12 * 7), addDays(today, 14)), kind: "vac", title: "Vacuna: Tos de las perreras", detail: "Recomendada para guarderías, residencias y parques con muchos perros.", cost: P.vacTos, cat: "vacunas" });
      }
    } else {
      var outdoor = has("exterior") || has("otrosgatos");
      if (ageWeeks < 18) {
        var lastKit = series("trivalente_gato", [8, 12, 16], P.vacTrivalente, "Primovacunación del gatito.");
        if (lastKit) push({ date: addMonths(lastKit, 12), kind: "vac", title: "Refuerzo de la trivalente", detail: "Un año después de la última dosis de gatito.", cost: P.vacTrivalente, cat: "vacunas" });
        if (outdoor) series("leucemia_felina", [9, 13], P.vacFelv, "Recomendada si sale al exterior o convive con otros gatos (con test previo).");
      } else {
        annual("trivalente_gato", P.vacTrivalente, has("interior") && !outdoor ? "En gatos de interior el veterinario puede espaciarla a cada 1-3 años." : "Refuerzo anual.");
        if (outdoor) {
          if (lastOf("leucemia_felina")) annual("leucemia_felina", P.vacFelv, "Por salir al exterior o convivir con otros gatos.");
          else push({ date: addDays(today, 14), kind: "vac", title: "Test y vacuna de leucemia felina", detail: "Recomendada si sale al exterior o convive con otros gatos.", cost: P.vacFelv + P.testFelv, cat: "vacunas" });
        }
      }
      if (has("viaja") || has("exterior")) {
        if (lastOf("rabia")) annual("rabia", P.vacRabia, "Necesaria para viajar; obligatoria en algunas comunidades.");
        else if (ageWeeks >= 10) push({ date: maxDate(addDays(birth, 16 * 7), addDays(today, 14)), kind: "vac", title: "Vacuna: Rabia", detail: "Necesaria para viajar y obligatoria en algunas comunidades autónomas.", cost: P.vacRabia, cat: "vacunas" });
      }
    }

    // Microchip
    if (ageMonths < 4 && !(x && x.mascota && x.mascota.microchip)) {
      push({ date: addDays(today, 7), kind: "rev", title: "Microchip e inscripción en el registro", detail: "Obligatorio en España. Lo ponemos en la primera visita.", cost: P.microchip, cat: "otros" });
    }

    // Desparasitación interna
    var desps = (x && Array.isArray(x.desparasitaciones)) ? x.desparasitaciones : [];
    var lastInt = desps.filter(function (d) { return d.tipo !== "externa" && parseDate(d.fecha); }).map(function (d) { return parseDate(d.fecha); }).sort(function (a, b) { return b - a; })[0];
    var highRisk = isDog ? ((has("campo") || has("guarderia")) && has("ninos")) : (has("exterior") && has("ninos"));
    var indoorCat = !isDog && has("interior") && !has("exterior");
    var adultEvery = highRisk ? 2 : (indoorCat && !has("ninos") ? 6 : 3);
    var cursor = lastInt || (p.ultimaDesp === "reciente" ? addDays(today, -45) : null);
    var ageAtD = function (dt) { return (dt - birth) / (1000 * 60 * 60 * 24 * 30.44); };
    var nextDesp = function (dt) {
      var a = ageAtD(dt);
      return a < 3 ? addDays(dt, 15) : addMonths(dt, a < 6 ? 1 : adultEvery);
    };
    var first = cursor ? nextDesp(cursor) : addDays(today, 7);
    if (first < addDays(today, 7)) first = addDays(today, 7);
    var dates = [first], cur = first, guard = 0;
    while (guard++ < 40) {
      cur = nextDesp(cur);
      if (cur > end) break;
      dates.push(cur);
    }
    dates.forEach(function (d, i) {
      push({ date: d, kind: "desp", title: "Desparasitación interna", detail: i === 0 && !cursor ? "Primera toma cuanto antes." : "Comprimido según su peso.", cost: P.despInterna * wf, cat: "despInterna", silentLate: true });
    });
    routine.push({ title: "Desparasitación interna", detail: ageMonths < 6 ? "Cada 15 días hasta los 3 meses y mensual hasta los 6; después, cada " + adultEvery + " meses." : "Cada " + adultEvery + " meses" + (highRisk ? " (más frecuente por su estilo de vida)." : ".") });

    // Protección externa
    var extMonths = isDog ? 12 : (indoorCat ? 4 : 12);
    var extFactor = ageMonths < 2 ? Math.max(0, 12 - (2 - ageMonths)) / 12 : 1;
    var extCost = (isDog || !indoorCat ? 12 : 4) * P.despExternaMes * wf * extFactor;
    routine.push({ title: "Protección externa (pulgas, garrapatas" + (isDog ? ", mosquitos" : "") + ")", detail: isDog ? (zone ? "Continua todo el año. En zona mediterránea recomendamos collar repelente frente al flebotomo (leishmania) + pipeta o comprimido." : "Continua todo el año: pipeta, comprimido o collar.") : (indoorCat ? "Cada 3 meses (más a menudo si convive con perros)." : "Mensual, con pipeta o collar.") });
    push({ date: addDays(today, 7), kind: "desp", title: "Inicio de la protección externa", detail: isDog && zone ? "Collar repelente + antiparasitario. Te ayudamos a elegir el mejor para su peso." : "Antiparasitario externo adecuado a su peso.", cost: 0, cat: "info" });

    // Revisiones
    var chronic = p.salud === "cronico" || p.salud === "tratamiento";
    if (stage === "cachorro") {
      if (ageMonths < 6) push({ date: addMonths(birth, 6) < addDays(today, 10) ? addDays(today, 30) : addMonths(birth, 6), kind: "rev", title: "Revisión de los 6 meses", detail: "Crecimiento, dentición, alimentación y valoración de esterilización.", cost: P.consulta, cat: "consultas" });
      push({ date: addMonths(birth, 12) < addDays(today, 10) ? addDays(today, 60) : addMonths(birth, 12), kind: "rev", title: "Revisión del primer año", detail: "Paso a alimentación de adulto y repaso del plan preventivo.", cost: P.consulta, cat: "consultas" });
    } else if (stage === "adulto") {
      push({ date: addDays(today, 30), kind: "rev", title: "Revisión anual completa", detail: "Exploración general, peso, piel, oídos, ojos y boca.", cost: P.consulta, cat: "consultas" });
      if ((isDog && ageYears >= 5) || (!isDog && ageYears >= 7) || chronic) push({ date: addDays(today, 30), kind: "rev", title: "Analítica preventiva", detail: "Sangre y orina para detectar a tiempo problemas de riñón, hígado o tiroides.", cost: P.analitica, cat: "analiticas" });
    } else {
      push({ date: addDays(today, 30), kind: "rev", title: "Revisión senior + analítica completa", detail: "Corazón, riñón, tiroides, tensión arterial y articulaciones.", cost: P.consulta + P.analiticaSenior, cat: "senior" });
      push({ date: addMonths(today, 7), kind: "rev", title: "Segunda revisión senior + analítica", detail: "A partir de cierta edad, los cambios pueden ser rápidos: mejor dos controles al año.", cost: P.consulta + P.analiticaSenior, cat: "senior" });
    }
    if (chronic) {
      [3, 6, 9].forEach(function (m) { push({ date: addMonths(today, m), kind: "rev", title: "Control de su " + (p.salud === "tratamiento" ? "tratamiento" : "enfermedad crónica"), detail: "Frecuencia orientativa; la ajustará su veterinario.", cost: P.consulta, cat: "consultas" }); });
    }
    // Dental
    var smallDog = isDog && peso && peso < 10;
    var needsDental = stage === "senior" || (ageYears >= 3 && (smallDog || !isDog));
    if (needsDental) push({ date: addMonths(today, 4), kind: "rev", title: "Revisión y limpieza dental", detail: smallDog ? "Las razas pequeñas acumulan sarro antes: una limpieza al año evita dolor y extracciones." : "Revisión de encías y, si hay sarro, limpieza con ultrasonidos bajo sedación.", cost: P.limpiezaDental, cat: "dental" });

    // Esterilización (aparte, no entra en la comparativa anual)
    var sterilize = p.esterilizado === "no" && ageMonths >= (isDog ? 6 : 5);
    var sterilizeSoon = p.esterilizado === "no" && !sterilize;

    // Orden
    items.sort(function (a, b) {
      if (!a.date && !b.date) return 0; if (!a.date) return 1; if (!b.date) return -1;
      return a.date - b.date;
    });

    // Costes
    var imprevistos = (stage === "senior" || chronic ? 2 : 1) * P.consulta;
    var byCat = { vacunas: 0, despInterna: 0, consultas: 0, analiticas: 0, senior: 0, dental: 0, otros: 0 };
    items.forEach(function (it) { if (byCat[it.cat] != null) byCat[it.cat] += it.cost; });
    byCat.consultas += imprevistos;
    var sueltas = byCat.vacunas + byCat.despInterna + byCat.consultas + byCat.analiticas + byCat.senior + byCat.dental + byCat.otros + extCost;

    var planKey = stage;
    var plan = (data.plans || {})[planKey] || { name: "Plan de salud", perro: 25, gato: 18, covers: [] };
    var fee = isDog ? plan.perro : plan.gato;
    var dentalDisc = stage === "senior" ? 0.20 : 0.15;
    var planTotal = fee * 12 + extCost * 0.9 + byCat.dental * (1 - dentalDisc);

    return {
      stage: stage, isDog: isDog, ageMonths: ageMonths, items: items, routine: routine, birthFromDoc: !!(x && x.mascota && parseDate(x.mascota.fecha_nacimiento)),
      costs: { byCat: byCat, ext: extCost, imprevistos: imprevistos, sueltas: sueltas, fee: fee, planTotal: planTotal, dentalDisc: dentalDisc },
      plan: plan, sterilize: sterilize, sterilizeSoon: sterilizeSoon, chronic: chronic
    };
  }

  function localTips(p, plan) {
    var t = [];
    if (plan.stage === "cachorro") {
      t.push(plan.isDog ? "Hasta completar las vacunas, evita parques y zonas con muchos perros desconocidos; sí puede conocer a perros sanos y vacunados." : "Los gatitos aprenden rápido a usar el arenero: colócalo en un sitio tranquilo, lejos de su comida y agua.");
      t.push("Socializa con calma: ruidos, personas y manipulación suave de patas, orejas y boca le harán las visitas al veterinario mucho más fáciles.");
      t.push("Usa un pienso específico de " + (plan.isDog ? "cachorro" : "gatito") + " de buena calidad y repártelo en 3-4 tomas al día.");
    } else if (plan.stage === "senior") {
      t.push("Vigila si bebe u orina más de lo normal, si pierde peso o si le cuesta levantarse: son señales que conviene consultar pronto.");
      t.push("Un pienso senior y paseos más cortos pero frecuentes ayudan a sus articulaciones.");
      t.push("Revisa su boca: el dolor dental es muy habitual en mascotas mayores y a menudo pasa desapercibido.");
    } else {
      t.push("Mantén su peso ideal: deberías notar las costillas al tacto sin que se marquen a la vista.");
      t.push(plan.isDog ? "Cepillarle los dientes 2-3 veces por semana reduce mucho el sarro y la necesidad de limpiezas." : "Ofrécele varios puntos de agua (o una fuente) para que beba más: protege sus riñones.");
      t.push(plan.isDog ? "Revisa orejas y almohadillas después de pasear por campo: las espigas son una urgencia frecuente en primavera y verano." : "Los rascadores y el juego diario de 10-15 minutos previenen estrés y sobrepeso.");
    }
    if (plan.sterilize) t.push("Hablad en consulta de la esterilización: previene enfermedades y camadas no deseadas.");
    return t;
  }

  function initPlanner() {
    var root = $("[data-planner]");
    if (!root) return;
    var form = $(".planner-form", root);
    var steps = $$(".p-step", root);
    var prog = $$(".planner-progress li", root);
    var result = $("[data-result]", root);
    var extractBox = $("[data-extract]", root);
    var manual = $("[data-manual]", root);
    var drop = $("[data-drop]", root);
    var fileInput = $("input[type=file]", root);
    var current = 1;
    var extracted = null;

    function go(n) {
      current = n;
      steps.forEach(function (s) { s.classList.toggle("is-active", +s.getAttribute("data-step") === n); });
      prog.forEach(function (li, i) { li.classList.toggle("is-active", i === n - 1); li.classList.toggle("is-done", i < n - 1); });
      var top = root.getBoundingClientRect().top + window.scrollY - 90;
      if (Math.abs(window.scrollY - top) > 120) window.scrollTo({ top: top, behavior: "smooth" });
    }
    function stepEl(n) { return $('.p-step[data-step="' + n + '"]', root); }
    function showErr(n, msg) { var e = $(".p-error", stepEl(n)); if (e) { e.textContent = msg; e.hidden = !msg; } }

    // Especie → opciones de estilo de vida
    function syncSpecies() {
      var cat = form.especie.value === "gato";
      var dog = $("[data-life-dog]", root), catBox = $("[data-life-cat]", root);
      dog.hidden = cat; catBox.hidden = !cat;
      $$("input", cat ? dog : catBox).forEach(function (i) { i.checked = false; });
      form.peso.placeholder = cat ? "4" : "12";
    }
    $$('input[name="especie"]', root).forEach(function (r) { r.addEventListener("change", syncSpecies); });

    function profile() {
      var fd = new FormData(form);
      var edad = parseFloat(fd.get("edad"));
      var unit = fd.get("edadUnidad");
      var ageMonths = isNaN(edad) ? NaN : unit === "anos" ? edad * 12 : unit === "semanas" ? edad / 4.345 : edad;
      return {
        especie: fd.get("especie") || "perro",
        nombre: String(fd.get("nombre") || "").trim(),
        raza: String(fd.get("raza") || "").trim(),
        edad: edad, edadUnidad: unit, ageMonths: ageMonths,
        peso: parseFloat(fd.get("peso")) || 0,
        vida: fd.getAll("vida"),
        esterilizado: fd.get("esterilizado") || "",
        salud: fd.get("salud") || "sano",
        notas: String(fd.get("notas") || "").trim(),
        vacunasAlDia: fd.get("vacunasAlDia") || "nose",
        ultimaDesp: fd.get("ultimaDesp") || "nose"
      };
    }

    root.addEventListener("click", function (e) {
      if (e.target.closest("[data-next]")) {
        var p = profile();
        if (current === 1) {
          if (isNaN(p.ageMonths) || p.ageMonths < 0 || p.edad === "") return showErr(1, "Indica su edad aproximada para calcular el calendario.");
          if (p.ageMonths > 360) return showErr(1, "Revisa la edad, parece demasiado alta.");
          if (p.peso && (p.peso < 0.2 || p.peso > 100)) return showErr(1, "Revisa el peso en kilos.");
          showErr(1, "");
        }
        go(Math.min(current + 1, 4));
      }
      if (e.target.closest("[data-prev]")) go(Math.max(current - 1, 1));
    });

    // ---- Lectura de la cartilla / informe con IA ----
    var REASONS = {
      sin_clave: "La lectura automática se está terminando de configurar. Responde las dos preguntas de abajo y seguimos.",
      tipo: "Ese archivo no es una foto ni un PDF. Prueba con una imagen (JPG, PNG, HEIC) o un PDF.",
      tamano: "El archivo pesa más de 10 MB. Prueba con una foto más ligera.",
      rate_min: "Vas muy rápido 🙂 Espera un minuto y vuelve a intentarlo.",
      rate_day: "Has hecho muchas lecturas hoy. Responde las preguntas de abajo y seguimos.",
      rate_global: "La lectura automática está muy solicitada ahora mismo. Responde las preguntas de abajo y seguimos.",
      no_documento: "No parece una cartilla ni un informe veterinario. ¿Puedes probar con otra foto, con buena luz y enfocada?",
      ia: "No he podido leer bien el documento. Prueba con una foto más nítida o responde las preguntas de abajo."
    };
    function dash(v) { return v == null || v === "" ? "—" : escHTML(v); }
    function renderExtract(file, d) {
      var m = d.mascota || {};
      var vac = (d.vacunas || []).map(function (v) {
        return "<tr><td>" + dash(v.nombre) + "</td><td>" + (v.fecha ? fmtDate(parseDate(v.fecha)) : "—") + "</td><td>" + (v.proxima ? fmtDate(parseDate(v.proxima)) : "—") + "</td></tr>";
      }).join("");
      var desp = (d.desparasitaciones || []).map(function (v) {
        return "<tr><td>" + (v.tipo === "externa" ? "Externa" : v.tipo === "interna" ? "Interna" : "—") + (v.producto ? " · " + escHTML(v.producto) : "") + "</td><td>" + (v.fecha ? fmtDate(parseDate(v.fecha)) : "—") + "</td><td></td></tr>";
      }).join("");
      var other = [].concat(d.tratamientos || [], d.diagnosticos || [], (d.alergias || []).map(function (a) { return "Alergia: " + a; }));
      var html = "<h4>" + svgUse("i-spark") + " Esto es lo que hemos leído</h4>" +
        '<p class="extract-file">' + svgUse("i-file").replace("<svg", '<svg style="display:inline;width:14px;height:14px;vertical-align:-2px"') + " " + escHTML(file.name) + "</p>" +
        '<div class="x-meta"><span>Nombre: <b>' + dash(m.nombre) + "</b></span><span>Especie: <b>" + dash(m.especie) + "</b></span><span>Raza: <b>" + dash(m.raza) + "</b></span><span>Nacimiento: <b>" + (m.fecha_nacimiento ? fmtDate(parseDate(m.fecha_nacimiento)) : "—") + "</b></span><span>Microchip: <b>" + dash(m.microchip) + "</b></span></div>";
      if (vac || desp) {
        html += '<table class="x-table"><thead><tr><th>Vacuna / tratamiento</th><th>Fecha</th><th>Próxima</th></tr></thead><tbody>' + vac + desp + "</tbody></table>";
      } else {
        html += '<p class="x-warn">No hemos encontrado vacunas ni desparasitaciones con fecha en el documento.</p>';
      }
      if (other.length) html += '<p style="margin-top:12px;font-size:.88rem;color:var(--on-dark-2)"><b>Otros datos:</b> ' + other.map(escHTML).join(" · ") + "</p>";
      html += '<button type="button" class="x-reset" data-x-reset>Usar otro documento</button>';
      extractBox.innerHTML = html;
    }
    function resetExtract() {
      extracted = null; extractBox.hidden = true; extractBox.innerHTML = ""; manual.hidden = false; fileInput.value = ""; drop.hidden = false;
    }
    extractBox.addEventListener("click", function (e) { if (e.target.closest("[data-x-reset]")) resetExtract(); });

    function readFile(file) {
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { extractBox.hidden = false; extractBox.innerHTML = '<p class="x-warn">' + REASONS.tamano + "</p>"; return; }
      extractBox.hidden = false;
      drop.hidden = true;
      extractBox.innerHTML = '<div class="extract-load"><span class="scan-bar"></span><div><strong>Leyendo el documento…</strong><br><small>La IA está buscando vacunas, fechas y tratamientos. Tarda unos segundos.</small></div></div>';
      var fd = new FormData();
      fd.append("documento", file);
      var ctrl = window.AbortController ? new AbortController() : null;
      var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 60000) : null;
      fetch("lector-documento.php", { method: "POST", body: fd, signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { return (r.headers.get("content-type") || "").indexOf("json") !== -1 ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (res) {
          if (t) clearTimeout(t);
          if (res && res.ok && res.data) {
            extracted = res.data;
            renderExtract(file, res.data);
            manual.hidden = true;
            // Si la cartilla trae especie/nombre y el usuario no los puso, los aprovechamos
            var m = res.data.mascota || {};
            if (m.nombre && !form.nombre.value) form.nombre.value = m.nombre;
            if (m.raza && !form.raza.value) form.raza.value = m.raza;
          } else {
            var reason = (res && REASONS[res.reason]) || (res ? REASONS.ia : "No he podido conectar con el lector ahora mismo. Responde las dos preguntas de abajo y seguimos.");
            extractBox.innerHTML = '<p class="x-warn">' + reason + '</p><button type="button" class="x-reset" data-x-reset>Probar con otro archivo</button>';
            manual.hidden = false;
          }
        });
    }
    fileInput.addEventListener("change", function () { readFile(fileInput.files && fileInput.files[0]); });
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove("is-over"); }); });
    drop.addEventListener("drop", function (e) {
      e.preventDefault();
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readFile(f);
    });

    // ---- Envío: email → plan ----
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var email = String(fd.get("email") || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr(4, "Revisa el email, parece que falta algo.");
      if (!fd.get("consent")) return showErr(4, "Necesitamos tu permiso para guardar el email y enviarte el plan.");
      showErr(4, "");
      var p = profile();
      var plan = buildPlan(p, extracted);
      var petName = p.nombre || (extracted && extracted.mascota && extracted.mascota.nombre) || (p.especie === "gato" ? "tu gato" : "tu perro");

      form.hidden = true;
      $(".planner-progress", root).hidden = true;
      result.hidden = false;
      result.innerHTML = '<div class="plan-building">' + svgUse("logo-mark") + "<strong>Preparando el plan de " + escHTML(petName) + "…</strong><small>Calculando calendario, revisiones y costes</small></div>";
      root.scrollIntoView({ behavior: "smooth", block: "start" });

      var next3 = plan.items.filter(function (i) { return i.date; }).slice(0, 4).map(function (i) { return { que: i.title, fecha: i.date.toISOString().slice(0, 10) }; });
      var mascota = { especie: p.especie, nombre: petName, raza: p.raza, edad_meses: Math.round(plan.ageMonths * 10) / 10, peso_kg: p.peso || null, estilo_vida: p.vida, esterilizado: p.esterilizado, salud: p.salud, notas: p.notas };
      var leadP = postJSON("lead.php", {
        tipo: "plan", tutor: String(fd.get("tutor") || ""), email: email, telefono: String(fd.get("telefono") || ""), consent: true,
        mascota: mascota,
        resumen: { etapa: plan.stage, plan: plan.plan.name, coste_sueltas: Math.round(plan.costs.sueltas), coste_plan: Math.round(plan.costs.planTotal), proximas: next3, cartilla_leida: !!extracted }
      }, 15000);
      var tipsP = postJSON("consejos-ia.php", {
        mascota: mascota, etapa: plan.stage,
        proximas: next3.map(function (n) { return n.que; }),
        cartilla: extracted ? { tratamientos: extracted.tratamientos || [], diagnosticos: extracted.diagnosticos || [], alergias: extracted.alergias || [] } : null
      }, 25000);
      var minWait = new Promise(function (r) { setTimeout(r, 1400); });
      Promise.all([leadP, tipsP, minWait]).then(function (res) {
        renderPlan(p, plan, petName, res[0], res[1]);
      });
    });

    function renderPlan(p, plan, petName, leadRes, tipsRes) {
      var stageLabel = { cachorro: plan.isDog ? "Cachorro" : "Gatito", adulto: "Adulto", senior: "Senior" }[plan.stage];
      var ageTxt = plan.ageMonths < 4 ? Math.round(plan.ageMonths * 4.345) + " semanas" : plan.ageMonths < 24 ? Math.round(plan.ageMonths) + " meses" : Math.floor(plan.ageMonths / 12) + " años";
      var c = plan.costs;
      var save = c.sueltas - c.planTotal;
      var tags = '<span class="hot">' + stageLabel + "</span><span>" + (plan.isDog ? "Perro" : "Gato") + "</span>" + (p.raza ? "<span>" + escHTML(p.raza) + "</span>" : "") + "<span>" + ageTxt + (plan.birthFromDoc ? " (según cartilla)" : "") + "</span>" + (p.peso ? "<span>" + String(p.peso).replace(".", ",") + " kg</span>" : "") + (extracted ? "<span>Cartilla leída con IA ✓</span>" : "");

      var tl = plan.items.map(function (it) {
        var kind = it.kind === "vac" ? "vac" : it.kind === "desp" ? "desp" : "rev";
        var kindTxt = it.kind === "vac" ? "Vacuna" : it.kind === "desp" ? "Desparasitación" : "Revisión";
        var dateHtml = it.date ? (it.late && !it.silentLate ? "Cuanto antes<small>atrasada</small>" : it.date.getDate() + " " + MONTHS[it.date.getMonth()] + "<small>" + it.date.getFullYear() + "</small>") : "Por confirmar<small>según cartilla</small>";
        return '<li class="tl-item' + (it.late && !it.silentLate ? " is-late" : "") + '"><div class="tl-date">' + dateHtml + '</div><div class="tl-body"><span class="tl-kind ' + kind + '">' + kindTxt + "</span><strong>" + escHTML(it.title.replace(/^Vacuna: /, "")) + "</strong><p>" + escHTML(it.detail) + (it.cost ? " · ~" + eur(it.cost) : "") + "</p></div></li>";
      }).join("");

      var routine = plan.routine.map(function (r) { return "<li><strong>" + escHTML(r.title) + ":</strong>&nbsp;" + escHTML(r.detail) + "</li>"; }).join("");

      var b = c.byCat;
      var row = function (label, v) { return v > 0.5 ? "<li><span>" + label + "</span><b>" + eur(v) + "</b></li>" : ""; };
      var sueltasList = row("Vacunas", b.vacunas) + row("Desparasitación interna", b.despInterna) + row("Protección externa", c.ext) + row("Revisiones y consultas*", b.consultas) + row("Analíticas", b.analiticas) + row("Revisiones senior + analítica", b.senior) + row("Dental", b.dental) + row("Microchip", b.otros);
      var planList = "<li><span>Cuota " + eur(c.fee) + "/mes × 12</span><b>" + eur(c.fee * 12) + "</b></li>" + row("Protección externa (−10 %)", c.ext * 0.9) + row("Dental (−" + Math.round(c.dentalDisc * 100) + " %)", b.dental * (1 - c.dentalDisc));
      var saveHtml = save >= 20
        ? '<div class="cost-save">' + svgUse("i-heart") + "<span>Con el " + escHTML(plan.plan.name) + " ahorrarías unos <strong>" + eur(save) + " al año</strong>, y además tendrías consultas ilimitadas.</span></div>"
        : '<div class="cost-save" style="background:var(--ink-4)">' + svgUse("i-heart") + "<span>En su caso, el coste es parecido con visitas sueltas o con el plan. La ventaja del plan es la tranquilidad: consultas ilimitadas, recordatorios y descuentos si surge algo.</span></div>";
      var benefits = (plan.plan.covers || []).map(function (x) { return "<li>" + svgUse("i-check") + escHTML(x) + "</li>"; }).join("");

      var tips = (tipsRes && Array.isArray(tipsRes.consejos) && tipsRes.consejos.length) ? tipsRes.consejos : localTips(p, plan);
      var tipsFromAI = !!(tipsRes && Array.isArray(tipsRes.consejos) && tipsRes.consejos.length);
      var tipsHtml = tips.slice(0, 5).map(function (t) { return "<li>" + escHTML(t) + "</li>"; }).join("");

      var extra = "";
      if (plan.sterilize) extra += '<div class="plan-alert" style="background:rgba(255,195,0,.08);border-color:rgba(255,195,0,.35)">' + svgUse("i-scalpel") + "<span><strong>Valorad la esterilización.</strong> Por su edad, es un buen momento para hablarlo en consulta. Precio orientativo: desde " + eur(plan.isDog ? data.prices.esterilizacionPerro : data.prices.esterilizacionGato) + " (no incluido en la comparativa).</span></div>";
      if (plan.chronic) extra += '<div class="plan-alert">' + svgUse("i-steth") + "<span>Como tiene una enfermedad o tratamiento en curso, su veterinario adaptará las fechas y puede que alguna vacuna se retrase. <strong>No cambies su medicación sin consultarlo.</strong></span></div>";

      var leadNote = (leadRes && leadRes.ok) ? "Hemos guardado tu email: el equipo de Amigo Fiel podrá ayudarte a confirmar este plan." : "No hemos podido guardar tu email ahora mismo. Si quieres que te contactemos, pide cita o llámanos.";

      result.innerHTML =
        '<div class="plan-hero"><p class="eyebrow">' + svgUse("i-spark").replace("<svg", '<svg style="width:16px;height:16px"') + " Plan de cuidados preventivos</p>" +
        "<h3>El plan de <em>" + escHTML(petName) + "</em> para los próximos 12 meses</h3>" +
        '<div class="plan-tags">' + tags + "</div></div>" +

        '<div class="plan-block"><h4>' + svgUse("i-cal") + " Calendario<small>" + plan.items.length + " citas</small></h4><ol class=\"timeline\">" + tl + "</ol></div>" +

        '<div class="plan-block"><h4>' + svgUse("i-paw") + ' Rutina de prevención</h4><ul class="tips">' + routine + "</ul>" + extra + "</div>" +

        '<div class="plan-block"><h4>' + svgUse("i-shield") + " Coste anual estimado<small>orientativo</small></h4>" +
        '<div class="cost-grid"><div class="cost-card"><h5>Visitas sueltas</h5><div class="big">' + eur(c.sueltas) + "<small> /año</small></div><ul>" + sueltasList + "</ul></div>" +
        '<div class="cost-card best"><h5>' + escHTML(plan.plan.name) + '</h5><div class="big">' + eur(c.planTotal) + "<small> /año</small></div><ul>" + planList + "</ul></div></div>" +
        saveHtml +
        '<ul class="benefits">' + benefits + "</ul>" +
        '<p class="plan-foot">* Incluye una estimación de ' + (c.imprevistos / data.prices.consulta) + " consulta" + (c.imprevistos / data.prices.consulta > 1 ? "s" : "") + " por imprevistos al año. Precios orientativos de ejemplo.</p></div>" +

        '<div class="plan-block"><h4>' + svgUse("i-heart") + " Consejos para " + escHTML(petName) + '</h4><ul class="tips">' + tipsHtml + '</ul><p class="tips-src">' + (tipsFromAI ? "Consejos personalizados generados con IA a partir de sus datos." : "Consejos generales para su etapa.") + "</p></div>" +

        '<div class="plan-actions"><a class="btn btn-red btn-lg magnetic" href="#contacto">' + svgUse("i-cal") + ' Pedir cita para confirmarlo</a><button type="button" class="btn btn-ghost" data-print>' + svgUse("i-file") + ' Guardar en PDF</button><button type="button" class="btn btn-ghost-dark" data-restart>Hacer otro plan</button></div>' +
        '<p class="plan-foot">' + leadNote + " Este plan es una estimación orientativa generada automáticamente: el veterinario lo revisará y confirmará en consulta.</p>";

      var selectAppt = $('[data-appt] select[name="motivo"]');
      if (selectAppt) selectAppt.value = plan.stage === "cachorro" ? "Primera visita (cachorro o gatito)" : plan.stage === "senior" ? "Revisión senior" : "Vacunación / desparasitación";
      var petField = $('[data-appt] input[name="mascota"]');
      if (petField && !petField.value && p.nombre) petField.value = p.nombre;
      var em = $('[data-appt] input[name="email"]');
      if (em && !em.value) em.value = String(new FormData(form).get("email") || "");
    }

    result.addEventListener("click", function (e) {
      if (e.target.closest("[data-print]")) window.print();
      if (e.target.closest("[data-restart]")) {
        result.hidden = true; result.innerHTML = "";
        form.hidden = false; $(".planner-progress", root).hidden = false;
        resetExtract();
        go(1);
      }
    });
  }

  function initYear() { $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); }); }

  function boot() {
    safe(initSplash, "splash");
    safe(initNav, "nav");
    safe(initReveals, "reveals");
    safe(initCounters, "counters");
    safe(initHeroSpot, "heroSpot");
    safe(initTilt, "tilt");
    safe(initMagnetic, "magnetic");
    safe(initStages, "stages");
    safe(initAppointment, "appointment");
    safe(initChat, "chat");
    safe(initPlanner, "planner");
    safe(initYear, "year");
    safe(initGsap, "gsap");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
