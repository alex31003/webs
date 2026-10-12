(function () {
  "use strict";

  var B = window.__BRAND__ || {};
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fineHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }
  function waLink(text) { return "https://wa.me/" + (B.whatsappIntl || "593981943602") + "?text=" + encodeURIComponent(text); }
  function postJSON(url, data, timeoutMs) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 45000) : null;
    return fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data), signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    });
  }

  /* ---------- Splash ---------- */
  function initSplash() {
    var s = $("[data-splash]");
    if (!s) return;
    var hide = function () { s.classList.add("is-out"); };
    if (document.readyState === "complete") setTimeout(hide, 700);
    else window.addEventListener("load", function () { setTimeout(hide, 500); });
    setTimeout(hide, 3200);
  }

  /* ---------- Navegación ---------- */
  function initNav() {
    var nav = $("[data-nav]"), toggle = $("[data-menu-toggle]");
    if (!nav) return;
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 30); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = !nav.classList.contains("menu-open");
        nav.classList.toggle("menu-open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      });
      $$("[data-menu] a").forEach(function (a) {
        a.addEventListener("click", function () {
          nav.classList.remove("menu-open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }
    var y = $("[data-year]");
    if (y) y.textContent = new Date().getFullYear();
  }

  /* ---------- Revelado al hacer scroll ---------- */
  function initReveals() {
    var els = $$(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("is-visible"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var sib = el.parentElement ? $$(":scope > .reveal", el.parentElement) : [];
        var i = Math.max(0, sib.indexOf(el));
        el.style.transitionDelay = Math.min(i * 90, 450) + "ms";
        el.classList.add("is-visible");
        io.unobserve(el);
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (e) { io.observe(e); });
    setTimeout(function () {
      els.forEach(function (e) { if (e.getBoundingClientRect().top < innerHeight) e.classList.add("is-visible"); });
    }, 6000);
  }

  /* ---------- Partículas doradas ---------- */
  function initParticles() {
    if (reduced) return;
    $$("[data-particles]").forEach(function (cv) {
      var ctx = cv.getContext("2d");
      if (!ctx) return;
      var soft = cv.classList.contains("gold-dust-soft");
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var W = 0, H = 0, parts = [], running = false, raf = 0;
      function size() {
        var r = cv.getBoundingClientRect();
        W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var n = Math.round(Math.min(90, (W * H) / (soft ? 26000 : 14000)));
        parts = [];
        for (var i = 0; i < n; i++) parts.push(make(true));
      }
      function make(anywhere) {
        return {
          x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10,
          r: Math.random() * 1.6 + 0.4, vy: -(Math.random() * 0.25 + 0.06), vx: (Math.random() - 0.5) * 0.12,
          a: Math.random() * 0.6 + 0.2, tw: Math.random() * Math.PI * 2, sp: Math.random() * 0.02 + 0.006
        };
      }
      function tick() {
        ctx.clearRect(0, 0, W, H);
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i];
          p.x += p.vx; p.y += p.vy; p.tw += p.sp;
          if (p.y < -10) parts[i] = p = make(false);
          var al = p.a * (0.55 + 0.45 * Math.sin(p.tw)) * (soft ? 0.7 : 1);
          var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          g.addColorStop(0, "rgba(243,222,154," + al + ")");
          g.addColorStop(0.4, "rgba(201,168,76," + al * 0.5 + ")");
          g.addColorStop(1, "rgba(201,168,76,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
        }
        raf = requestAnimationFrame(tick);
      }
      size();
      var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(size, 200); });
      new IntersectionObserver(function (en) {
        var vis = en[0].isIntersecting;
        if (vis && !running) { running = true; raf = requestAnimationFrame(tick); }
        else if (!vis && running) { running = false; cancelAnimationFrame(raf); }
      }, { threshold: 0 }).observe(cv);
    });
  }

  /* ---------- Parallax (GSAP + ScrollTrigger) ---------- */
  function initParallax() {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    var mobile = matchMedia("(max-width: 719px)").matches;
    $$("[data-speed]").forEach(function (el) {
      var sp = parseFloat(el.getAttribute("data-speed")) || 0;
      if (mobile) sp *= 0.4;
      gsap.fromTo(el, { y: -sp * 120 }, {
        y: sp * 120, ease: "none",
        scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: 0.6 }
      });
    });
    // Línea de pasos que se dibuja
    var path = $(".steps-line path");
    if (path && path.getTotalLength) {
      var L = path.getTotalLength();
      gsap.fromTo(path, { strokeDasharray: L, strokeDashoffset: L }, {
        strokeDashoffset: 0, ease: "none",
        scrollTrigger: { trigger: "[data-steps]", start: "top 80%", end: "bottom 60%", scrub: 0.8 }
      });
    }
    // Precios que "suben" al entrar
    $$(".price").forEach(function (el) {
      gsap.from(el, { yPercent: 40, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 92%" } });
    });
  }

  /* ---------- Tilt suave en tarjetas ---------- */
  function initTilt() {
    if (!fineHover) return;
    $$("[data-tilt]").forEach(function (card) {
      var base = getComputedStyle(card).transform;
      base = base === "none" ? "" : base;
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = base + " perspective(900px) rotateY(" + x * 6 + "deg) rotateX(" + -y * 6 + "deg) translateY(-4px)";
      });
      card.addEventListener("mouseout", function (e) {
        if (!card.contains(e.relatedTarget)) card.style.transform = "";
      });
    });
  }

  /* ---------- Formato seguro para respuestas de la IA ---------- */
  function richText(t) {
    var lines = esc(t).split(/\n/);
    var html = "", inList = false;
    lines.forEach(function (ln) {
      var li = /^\s*(?:[-•*]|\d+[.)])\s+(.*)$/.exec(ln);
      if (li) { if (!inList) { html += "<ul>"; inList = true; } html += "<li>" + li[1] + "</li>"; return; }
      if (inList) { html += "</ul>"; inList = false; }
      if (ln.trim()) html += "<p>" + ln + "</p>";
    });
    if (inList) html += "</ul>";
    return html
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/(^|[\s(>])\*(?!\s)([^*<]+?)\*(?=[\s).,!?<]|$)/g, "$1<em>$2</em>")
      .replace(/\b0?981\s?943\s?602\b/g, '<a href="https://wa.me/593981943602" target="_blank" rel="noopener">$&</a>')
      .replace(/@makeup_jhada/g, '<a href="https://instagram.com/makeup_jhada" target="_blank" rel="noopener">@makeup_jhada</a>');
  }

  /* ---------- Chat Jhada ✨ ---------- */
  function initChat() {
    var panel = $("[data-chat]"), fab = $("[data-chat-toggle]");
    if (!panel || !fab) return;
    var body = $("[data-chat-body]", panel), form = $("[data-chat-form]", panel), input = form.querySelector("input");
    var sugg = $("[data-chat-suggest]", panel);
    var history = [], busy = false;
    var FALLBACK = "Ahora mismo no puedo responderte por aquí 💛 Escríbele directo a Dayana al WhatsApp " + (B.whatsapp || "0981943602") + " o al Instagram " + (B.instagram || "@makeup_jhada") + ".";

    function open() {
      panel.hidden = false; fab.classList.add("is-open"); fab.setAttribute("aria-expanded", "true");
      setTimeout(function () { if (fineHover) input.focus(); }, 60);
      body.scrollTop = body.scrollHeight;
    }
    function close() { panel.hidden = true; fab.classList.remove("is-open"); fab.setAttribute("aria-expanded", "false"); fab.focus(); }
    fab.addEventListener("click", open);
    $("[data-chat-close]", panel).addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });
    $$("[data-open-chat]").forEach(function (b) { b.addEventListener("click", open); });

    function add(role, html) {
      var d = document.createElement("div");
      d.className = "msg " + (role === "user" ? "msg-user" : "msg-bot");
      d.innerHTML = html;
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
      return d;
    }
    function send(text) {
      text = String(text || "").trim();
      if (!text || busy) return;
      busy = true;
      if (sugg) sugg.hidden = true;
      add("user", "<p>" + esc(text) + "</p>");
      var typing = add("bot", '<span class="msg-typing"><i></i><i></i><i></i></span>');
      postJSON("api/chat.php", { message: text, history: history.slice(-10) }, 40000)
        .then(function (r) { return (r && r.reply) ? r.reply : FALLBACK; })
        .catch(function () { return FALLBACK; })
        .then(function (reply) {
          typing.remove();
          add("bot", richText(reply));
          history.push({ role: "user", text: text }, { role: "assistant", text: reply });
          busy = false;
        });
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value; input.value = ""; send(v); });
    if (sugg) $$("button", sugg).forEach(function (b) { b.addEventListener("click", function () { send(b.textContent); }); });
  }

  /* ---------- Planificador de Look ---------- */
  function initPlanner() {
    var root = $("[data-planner]");
    if (!root) return;
    var form = $("[data-planner-form]", root), steps = $$("[data-pstep]", root);
    var bar = $("[data-progress]", root), loading = $("[data-loading]", root), out = $("[data-plan]", root);
    var budget = $("[data-budget]", root), budgetOut = $("[data-budget-out]", root);
    var date = $("[data-date]", root), otro = $("[data-otro]", root);
    var cur = 1;

    if (date) { var t = new Date(); date.min = t.toISOString().slice(0, 10); }
    function paintBudget() {
      var v = +budget.value;
      budgetOut.textContent = v >= 100 ? "$100+" : "$" + v;
      budget.style.setProperty("--p", ((v - 20) / 80 * 100) + "%");
    }
    budget.addEventListener("input", paintBudget); paintBudget();
    $$('input[name="evento"]', form).forEach(function (r) {
      r.addEventListener("change", function () { otro.hidden = form.evento.value !== "otro"; });
    });

    function show(n) {
      cur = n;
      steps.forEach(function (s) { s.classList.toggle("is-active", +s.getAttribute("data-pstep") === n); });
      bar.style.width = (n / 3 * 100) + "%";
    }
    function valid(n) {
      var ok = true;
      if (n === 1) ok = !!form.evento.value;
      if (n === 2) ok = !!form.tono.value && !!form.estilo.value;
      var err = $("[data-pstep='" + n + "'] [data-error]", root);
      if (err) err.hidden = ok;
      return ok;
    }
    $$("[data-next]", root).forEach(function (b) { b.addEventListener("click", function () { if (valid(cur)) { show(cur + 1); root.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); } }); });
    $$("[data-prev]", root).forEach(function (b) { b.addEventListener("click", function () { show(cur - 1); }); });

    function data() {
      return {
        evento: form.evento.value, otro: form.otro.value, fecha: form.fecha.value,
        tono: form.tono.value, estilo: form.estilo.value, presupuesto: +form.presupuesto.value,
        peinado: form.peinado.value === "si", lugar: form.lugar.value, clases: form.clases.checked
      };
    }

    // Plan local (si la IA no está disponible): mismos precios reales
    function localPlan(d) {
      var key = B.eventoAPaquete[d.evento] || "social";
      if (d.evento === "otro" && d.estilo === "novia_clasica") key = "novia";
      var s = B.servicios[key], notas = [];
      if (d.presupuesto < s.precio) {
        notas.push(key !== "social" && d.presupuesto >= B.servicios.social.precio
          ? "Tu presupuesto aproximado ($" + d.presupuesto + ") está por debajo del paquete ideal. Una alternativa real es " + B.servicios.social.nombre + " ($" + B.servicios.social.precio + ")."
          : "Tu presupuesto aproximado ($" + d.presupuesto + ") está un poco por debajo de este paquete. Escríbele a Dayana y te orienta sin compromiso.");
      }
      if (d.lugar === "domicilio") notas.push(key === "fotos" ? "Para la sesión de fotos a domicilio, consulta disponibilidad y costo por WhatsApp." : "Elegiste a domicilio: tiene un costo adicional que depende de tu sector y se confirma por WhatsApp.");
      if (!d.peinado) notas.push("Todos los paquetes ya incluyen peinado (ondas o planchado). Si no lo necesitas, coméntaselo a Dayana al agendar.");
      return {
        paquete: { clave: key, nombre: s.nombre, precio: s.precio, incluye: s.incluye, duracion: s.duracion },
        notas: notas, domicilio: d.lugar === "domicilio",
        clases: (d.clases || d.presupuesto >= 100) ? { nombre: B.clases.nombre, detalle: B.clases.detalle, incluye: B.clases.incluye } : null,
        ia: null
      };
    }
    function localLook(d) {
      var pal = (B.paletas[d.tono] || B.paletas.media).map(function (p) { return { nombre: p[0], hex: p[1], uso: p[2] }; });
      return {
        titulo: (B.nombresEstilo[d.estilo] || "Glam") + " de " + (B.nombresEvento[d.evento] || "tu evento").toLowerCase(),
        resumen: "Una propuesta pensada para tu tono de piel " + d.tono + " y tu estilo " + (B.nombresEstilo[d.estilo] || "").toLowerCase() + ". Dayana la afinará contigo según tu rostro y tu outfit.",
        paleta: pal, tecnicas: null, ojos: "", labios: "", piel: "",
        peinado: d.peinado ? "Ondas suaves o planchado pulido, según tu outfit." : "Sin peinado",
        consejos: ["Llega con el rostro limpio, hidratado y sin base.", "Toma agua y descansa bien los días previos.", "Lleva una foto de tu outfit o del look que te inspira."]
      };
    }

    var LOAD_MSGS = ["Estudiando tu tono de piel…", "Eligiendo tu paleta de colores…", "Combinando técnicas para tu evento…", "Dando los últimos toques dorados…"];
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!valid(1)) { show(1); return; }
      if (!valid(2)) { show(2); return; }
      var d = data();
      form.hidden = true; loading.hidden = false; bar.style.width = "100%";
      var li = 0, lt = $("[data-loading-text]", root);
      var iv = setInterval(function () { li = (li + 1) % LOAD_MSGS.length; lt.textContent = LOAD_MSGS[li]; }, 1800);
      postJSON("api/plan.php", d, 60000)
        .then(function (r) { if (!r || !r.ok || !r.paquete) throw new Error("bad"); return r; })
        .catch(function () { return localPlan(d); })
        .then(function (plan) {
          clearInterval(iv);
          render(plan, d);
        });
    });

    function render(plan, d) {
      var look = plan.ia && plan.ia.paleta && plan.ia.paleta.length ? plan.ia : null;
      var fb = localLook(d);
      look = look || fb;
      var tecs = (look.tecnicas && look.tecnicas.length) ? look.tecnicas : null;
      if (!tecs) {
        var base = [];
        plan.paquete.incluye.forEach(function (i) {
          if (i === "Piel blindada") base.push({ nombre: "Piel blindada", porque: "Sella el maquillaje para que resista el calor y la humedad." });
          if (i === "Técnica de fondeo") base.push({ nombre: "Fondeo", porque: "Base en capas finas, uniforme y duradera." });
          if (i === "Técnica strobing") base.push({ nombre: "Strobing", porque: "Glow estratégico que luce perfecto en cámara." });
        });
        (B.tecnicasEstilo[d.estilo] || []).forEach(function (t) { base.push({ nombre: t[0], porque: t[1] }); });
        tecs = base.slice(0, 5);
      }
      var p = plan.paquete;
      var h = "";
      h += '<p class="plan-kicker">Tu plan de look · ' + esc(B.nombresEvento[d.evento] || "") + (d.fecha ? " · " + esc(fmtDate(d.fecha)) : "") + "</p>";
      h += '<h3 class="plan-title">' + esc(look.titulo || "Tu look Jhada") + "</h3>";
      if (look.resumen) h += '<p class="plan-summary">' + esc(look.resumen) + "</p>";
      h += '<div class="plan-pack"><div><small>Paquete recomendado</small><h4>' + esc(p.nombre) + '</h4></div><div class="plan-price">$' + esc(p.precio) + "</div>";
      h += "<p>Incluye: " + esc(p.incluye.join(" · ")) + (plan.domicilio ? " · <b>+ costo de domicilio</b>" : "") + "</p></div>";

      h += '<div class="plan-sec"><h5>Paleta sugerida</h5><div class="swatches">';
      look.paleta.forEach(function (c) {
        h += '<div class="swatch"><i style="--c:' + esc(c.hex) + '"></i><b>' + esc(c.nombre) + "</b><span>" + esc(c.uso) + " · " + esc(c.hex) + "</span></div>";
      });
      h += "</div></div>";

      h += '<div class="plan-sec"><h5>Técnicas que aplicaríamos</h5><ul class="techs">';
      tecs.forEach(function (t) { h += "<li><b>" + esc(t.nombre) + "</b> — " + esc(t.porque) + "</li>"; });
      h += "</ul></div>";

      h += '<div class="plan-sec plan-details">';
      if (look.ojos) h += "<div><small>Ojos</small>" + esc(look.ojos) + "</div>";
      if (look.labios) h += "<div><small>Labios</small>" + esc(look.labios) + "</div>";
      if (look.piel) h += "<div><small>Piel</small>" + esc(look.piel) + "</div>";
      if (look.peinado) h += "<div><small>Peinado</small>" + esc(look.peinado) + "</div>";
      h += "<div><small>Tiempo estimado</small>" + esc(p.duracion) + "</div>";
      h += "<div><small>Precio del servicio</small>$" + esc(p.precio) + (plan.domicilio ? " + domicilio (se confirma por WhatsApp)" : " en estudio") + "</div>";
      h += "</div>";

      var notas = plan.notas || [];
      if (notas.length) {
        h += '<div class="plan-sec"><h5>Para tener en cuenta</h5><ul class="plan-notes">';
        notas.forEach(function (n) { h += "<li>" + esc(n) + "</li>"; });
        h += "</ul></div>";
      }
      if (look.consejos && look.consejos.length) {
        h += '<div class="plan-sec"><h5>Antes de tu cita</h5><ul class="plan-notes">';
        look.consejos.forEach(function (n) { h += "<li>" + esc(n) + "</li>"; });
        h += "</ul></div>";
      }
      if (plan.clases) {
        h += '<div class="plan-class">🎓 <b>¿Te gustaría aprender a hacerlo tú misma?</b> ' + esc(plan.clases.nombre) + ": " + esc(plan.clases.detalle) + ". Incluye gratis: " + esc(plan.clases.incluye.join(", ")) + ".</div>";
      }
      h += '<p class="plan-disclaimer">✦ Este plan es una recomendación orientativa creada con inteligencia artificial. El look final se ajustará según tu rostro real, tu piel y tu outfit en la sesión con Dayana.</p>';

      h += '<form class="lead-form" data-lead novalidate>';
      h += "<h5>Reserva tu cita con este plan</h5><p>Déjanos tu nombre y WhatsApp para que Dayana confirme tu fecha y horario directamente contigo.</p>";
      h += '<div class="row"><input type="text" name="nombre" placeholder="Tu nombre" autocomplete="name" maxlength="80" required aria-label="Tu nombre">';
      h += '<input type="tel" name="whatsapp" placeholder="Tu WhatsApp (09…)" autocomplete="tel" inputmode="tel" maxlength="20" required aria-label="Tu número de WhatsApp"></div>';
      h += '<label class="check"><input type="checkbox" name="consent" required><span>Acepto que Makeup Jhada guarde mis datos y mi plan solo para contactarme por WhatsApp sobre esta cita.</span></label>';
      h += '<button class="btn btn-gold" type="submit">Quiero que Dayana me contacte</button>';
      h += '<p class="lead-msg" data-lead-msg hidden></p></form>';
      h += '<div class="plan-actions"><button type="button" class="btn btn-text" data-restart>↺ Crear otro plan</button></div>';

      loading.hidden = true;
      out.innerHTML = h; out.hidden = false;
      out.focus({ preventScroll: true });
      root.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      bindLead(plan, look, d);
      $("[data-restart]", out).addEventListener("click", function () {
        out.hidden = true; out.innerHTML = ""; form.hidden = false; show(1);
      });
    }

    function fmtDate(iso) {
      var p = iso.split("-");
      var m = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
      return p.length === 3 ? (+p[2]) + " " + m[+p[1] - 1] + " " + p[0] : iso;
    }

    function bindLead(plan, look, d) {
      var lf = $("[data-lead]", out), msg = $("[data-lead-msg]", out);
      lf.addEventListener("submit", function (e) {
        e.preventDefault();
        var nombre = lf.nombre.value.trim(), tel = lf.whatsapp.value.trim();
        var digits = tel.replace(/\D/g, "");
        msg.hidden = false;
        if (nombre.length < 2) { msg.textContent = "Escribe tu nombre, por favor."; lf.nombre.focus(); return; }
        if (digits.length < 9) { msg.textContent = "Revisa tu número de WhatsApp (ej.: 0991234567)."; lf.whatsapp.focus(); return; }
        if (!lf.consent.checked) { msg.textContent = "Necesitamos tu autorización para contactarte."; return; }
        var btn = lf.querySelector("button"); btn.disabled = true; btn.textContent = "Enviando…";
        var payload = {
          nombre: nombre, whatsapp: tel, consent: true,
          plan: { evento: B.nombresEvento[d.evento] + (d.otro ? " (" + d.otro + ")" : ""), fecha: d.fecha, tono: d.tono, estilo: d.estilo, presupuesto: d.presupuesto,
            peinado: d.peinado, lugar: d.lugar, paquete: plan.paquete.nombre, precio: plan.paquete.precio, look: look.titulo, clases: d.clases }
        };
        var text = "Hola Dayana ✨ Soy " + nombre + ". Hice mi plan de look en la web:\n"
          + "• Evento: " + payload.plan.evento + (d.fecha ? " — " + fmtDate(d.fecha) : "") + "\n"
          + "• Paquete: " + plan.paquete.nombre + " ($" + plan.paquete.precio + ")" + (d.lugar === "domicilio" ? " a domicilio" : " en estudio") + "\n"
          + "• Look: " + (look.titulo || "") + " · tono " + d.tono + " · estilo " + (B.nombresEstilo[d.estilo] || d.estilo) + "\n"
          + "¿Me confirmas disponibilidad? Mi WhatsApp: " + tel;
        postJSON("api/lead.php", payload, 20000).catch(function () { return { ok: false }; }).then(function () {
          lf.innerHTML = '<h5>¡Listo, ' + esc(nombre) + '! 💛</h5><p>Recibimos tus datos. Dayana te escribirá a tu WhatsApp para confirmar tu cita. Si quieres adelantarte, envíale tu plan ahora:</p>'
            + '<a class="btn btn-gold" href="' + esc(waLink(text)) + '" target="_blank" rel="noopener">Enviar mi plan por WhatsApp</a>';
        });
      });
    }
  }

  function boot() {
    document.documentElement.classList.remove("no-js");
    safe(initSplash, "splash");
    safe(initNav, "nav");
    safe(initReveals, "reveals");
    safe(initParticles, "particles");
    safe(initTilt, "tilt");
    safe(initChat, "chat");
    safe(initPlanner, "planner");
    safe(initParallax, "parallax");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
