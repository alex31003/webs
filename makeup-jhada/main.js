/* =============================================================
   Makeup Jhada Beauty Studio — interacción (JS vanilla, sin librerías)
   ============================================================= */
(function () {
  "use strict";

  var WA_NUMBER = "593981943602";
  var WA_DIRECT = "https://wa.me/" + WA_NUMBER;
  var CHAT_ENDPOINT = "chat-jhada.php";

  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };

  function safe(fn, name) {
    try { fn(); } catch (e) { if (window.console) console.warn("[" + name + "]", e); }
  }

  /* ---------- Navbar ---------- */
  function initNav() {
    var nav = $("#nav");
    var burger = $("#navBurger");
    var links = $("#navLinks");
    if (!nav) return;

    function onScroll() { nav.classList.toggle("is-scrolled", window.scrollY > 40); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (!burger || !links) return;
    function setOpen(open) {
      nav.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      document.body.style.overflow = open ? "hidden" : "";
      document.documentElement.classList.toggle("nav-open", open);
    }
    burger.addEventListener("click", function () { setOpen(!nav.classList.contains("menu-open")); });
    $$("a", links).forEach(function (a) { a.addEventListener("click", function () { setOpen(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }

  /* ---------- Aparición al hacer scroll ---------- */
  function initReveals() {
    var items = $$(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -6% 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Contadores animados ---------- */
  function initCounters() {
    var nums = $$("[data-count]");
    if (!nums.length) return;
    function run(el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      if (reduced) { el.textContent = target; return; }
      var start = null, dur = 1800;
      function tick(t) {
        if (!start) start = t;
        var p = Math.min(1, (t - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(tick);
      }
      el.textContent = "0";
      requestAnimationFrame(tick);
    }
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { run(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.05 });
    nums.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Parallax suave ---------- */
  function initParallax() {
    if (reduced) return;
    var els = $$("[data-parallax]");
    if (!els.length) return;
    var ticking = false;
    function update() {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0;
        var host = el.parentElement;
        var r = host.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        var offset = (r.top + r.height / 2 - vh / 2) * -speed;
        el.style.transform = "translate3d(0," + offset.toFixed(1) + "px,0)";
      });
      ticking = false;
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  /* ---------- Sliders antes / después ----------
     Se mueven solos: antes completo → la barra cruza → después completo → regresa.
     Si la clienta toca o arrastra, se pausa y vuelve a moverse solo a los 5 s. */
  var BA_HOLD_BEFORE = 1300, BA_SWEEP = 2400, BA_HOLD_AFTER = 2200, BA_RESUME = 5000;
  var BA_CYCLE = BA_HOLD_BEFORE + BA_SWEEP + BA_HOLD_AFTER + BA_SWEEP;

  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  // Posición de la barra (100 = antes completo, 0 = después completo) en el instante t del ciclo
  function baCyclePos(t) {
    t = t % BA_CYCLE;
    if (t < BA_HOLD_BEFORE) return 100;
    t -= BA_HOLD_BEFORE;
    if (t < BA_SWEEP) return 100 - 100 * easeInOut(t / BA_SWEEP);
    t -= BA_SWEEP;
    if (t < BA_HOLD_AFTER) return 0;
    t -= BA_HOLD_AFTER;
    return 100 * easeInOut(t / BA_SWEEP);
  }

  function initBeforeAfter() {
    $$("[data-ba]").forEach(function (slider, index) {
      var handle = $(".ba-slider__handle", slider);
      var pos = 50;
      var dragging = false;
      var visible = false;
      var mode = "auto";       // auto | user | return
      var cycleStart = 0;
      var returnFrom = 0, returnStart = 0;
      var lastTouch = 0;
      var raf = null;

      function set(p) {
        pos = Math.max(0, Math.min(100, p));
        slider.style.setProperty("--pos", pos + "%");
        if (handle) handle.setAttribute("aria-valuenow", Math.round(pos));
      }
      function fromEvent(e) {
        var r = slider.getBoundingClientRect();
        var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        set((x / r.width) * 100);
      }
      function userTouched() {
        mode = "user";
        lastTouch = performance.now();
        slider.classList.add("is-manual");
      }

      function frame(now) {
        raf = null;
        if (!visible) return;
        if (mode === "user" && !dragging && now - lastTouch > BA_RESUME) {
          // vuelve suavemente al "antes" y retoma el ciclo
          mode = "return"; returnFrom = pos; returnStart = now;
          slider.classList.remove("is-manual");
        }
        if (mode === "return") {
          var k = Math.min(1, (now - returnStart) / 900);
          set(returnFrom + (100 - returnFrom) * easeInOut(k));
          if (k >= 1) { mode = "auto"; cycleStart = now; }
        } else if (mode === "auto") {
          set(baCyclePos(now - cycleStart));
        }
        raf = requestAnimationFrame(frame);
      }
      function play() { if (!raf) raf = requestAnimationFrame(frame); }

      if (!reduced && "IntersectionObserver" in window) {
        set(100);
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            var wasVisible = visible;
            visible = entry.isIntersecting;
            if (visible && !wasVisible) {
              if (mode === "auto") cycleStart = performance.now() + (index % 2) * 700 - BA_HOLD_BEFORE * 0.4;
              play();
            }
          });
        }, { threshold: 0.25 }).observe(slider);
      } else {
        set(50); // movimiento reducido: queda quieto a la mitad, se arrastra a mano
      }

      slider.addEventListener("pointerdown", function (e) {
        dragging = true;
        userTouched();
        slider.classList.add("is-dragging");
        if (slider.setPointerCapture) { try { slider.setPointerCapture(e.pointerId); } catch (_) {} }
        fromEvent(e);
      });
      slider.addEventListener("pointermove", function (e) { if (dragging) { lastTouch = performance.now(); fromEvent(e); } });
      function stop() { if (dragging) lastTouch = performance.now(); dragging = false; slider.classList.remove("is-dragging"); }
      slider.addEventListener("pointerup", stop);
      slider.addEventListener("pointercancel", stop);
      slider.addEventListener("lostpointercapture", stop);

      if (handle) {
        handle.addEventListener("keydown", function (e) {
          var step = e.shiftKey ? 10 : 4;
          var handled = true;
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") set(pos - step);
          else if (e.key === "ArrowRight" || e.key === "ArrowUp") set(pos + step);
          else if (e.key === "Home") set(0);
          else if (e.key === "End") set(100);
          else handled = false;
          if (handled) { userTouched(); e.preventDefault(); }
        });
      }
    });
  }

  /* ---------- Acordeón FAQ ---------- */
  function initFaq() {
    $$(".faq__item").forEach(function (item) {
      var btn = $(".faq__q button", item);
      if (!btn) return;
      btn.addEventListener("click", function () {
        var open = !item.classList.contains("is-open");
        $$(".faq__item.is-open").forEach(function (other) {
          if (other !== item) {
            other.classList.remove("is-open");
            var b = $(".faq__q button", other);
            if (b) b.setAttribute("aria-expanded", "false");
          }
        });
        item.classList.toggle("is-open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  /* =============================================================
     CHAT JHADA ✨
     El navegador habla con chat-jhada.php (mismo dominio), que guarda
     la clave de Claude en el servidor. Si ese archivo no responde
     (sin clave, sin PHP o sin internet), Jhada usa sus respuestas
     preparadas de abajo, con los precios reales del estudio.
     ============================================================= */

  var KNOWLEDGE = [
    {
      keys: ["conviene", "recomienda", "recomiendas", "paquete", "cual elijo", "cuál elijo", "presupuesto", "no se cual", "no sé cuál", "que me sirve"],
      answer: "¡Te ayudo a elegir! 💕 Depende de tu evento:\n• **Social o Graduación — $25**: ideal para graduaciones, cumpleaños o eventos sociales.\n• **XV Añeras — $35**: glam romántico con piel blindada y fondeo para que dure toda la fiesta.\n• **Novias — $50**: el más completo, con exfoliación, hidratación y piel blindada.\n• **Sesión de Fotos — $60**: con técnica strobing y 2 horas de backstage.\nCuéntame qué evento tienes y te digo cuál es perfecto para ti. ¿Lo agendamos? ✨"
    },
    {
      keys: ["novia", "boda", "matrimonio", "nupcial", "casar", "casarme"],
      answer: "💍 **Novias — $50**. Incluye limpieza facial, exfoliación, hidratación, maquillaje, piel blindada, pestañas y peinado. La sesión dura unas 2.5 horas. A domicilio tiene costo adicional según tu zona en Guayaquil.\n¡Las fechas de bodas se llenan rápido! ¿Quieres asegurar la tuya con Dayana? ✨",
      handoff: true
    },
    {
      keys: ["xv", "quince", "15 años", "quinceañera", "quinceanera", "añera", "anera"],
      answer: "👑 **XV Añeras — $35**. Incluye limpieza facial, maquillaje, piel blindada, técnica de fondeo, pestañas y peinado. Dura unas 2 horas. A domicilio tiene costo adicional.\n¡Vas a lucir como una princesa! ¿Agendamos tu fecha? ✨"
    },
    {
      keys: ["graduacion", "graduación", "social", "grado", "cumpleaños"],
      answer: "🌸 **Social o Graduación — $25**. Incluye limpieza facial, maquillaje, pestañas y peinado (ondas o planchado). Dura alrededor de 1.5 horas. A domicilio tiene costo adicional.\n¿Te gustaría agendar tu look? ✨"
    },
    {
      keys: ["foto", "fotos", "editorial", "book", "shooting"],
      answer: "📸 **Sesión de Fotos — $60**. Incluye limpieza facial, maquillaje, piel blindada, técnica strobing, backstage de 2 horas, pestañas y peinado. En total son unas 3 horas con backstage.\n¡Tu look va a brillar en cámara! ¿Lo agendamos? ✨"
    },
    {
      keys: ["clase", "clases", "curso", "aprender", "certific", "matricula", "matrícula", "alumna"],
      answer: "🎓 **Clases de Makeup Avanzado**: 12 clases a **$10 cada una** + **matrícula de $15**.\nIncluye GRATIS: camiseta, paleta de sombras, plantillas, materiales por clase, refrigerios, sesión de fotos profesional, clases de peinado y **certificación oficial** al completar las 12 clases.\n¿Quieres reservar tu cupo con Dayana? ✨",
      handoff: true
    },
    {
      keys: ["blindada", "blindaje"],
      answer: "La **piel blindada** es una técnica que fija el maquillaje por muchas más horas: resiste calor, sudor y lágrimas de emoción. Es ideal para eventos largos como bodas y XV. Viene incluida en XV Añeras, Novias y Sesión de Fotos. ¿Agendamos tu look? ✨"
    },
    {
      keys: ["strobing", "iluminacion", "iluminación", "fondeo", "glam", "tecnica", "técnica", "diferencia"],
      answer: "Te explico las técnicas ✨\n• **Strobing**: iluminación estratégica que hace brillar los puntos altos del rostro, perfecta para fotos.\n• **Fondeo**: base trabajada en capas para una piel uniforme y duradera.\n• **Piel blindada**: fijación total para que el maquillaje aguante todo el evento.\n• **Glam**: look con más dramatismo, ojos intensos y acabado impactante.\n¿Cuál te gustaría para tu evento?"
    },
    {
      keys: ["dura", "duración", "duracion", "cuanto tiempo", "cuánto tiempo", "horas", "demora"],
      answer: "⏱️ Duración aproximada de cada sesión:\n• Social o Graduación: 1.5 horas\n• XV Años: 2 horas\n• Novia: 2.5 horas\n• Sesión de Fotos: 3 horas con backstage\n¿Para qué evento te gustaría agendar?"
    },
    {
      keys: ["preparo", "preparar", "piel antes", "llegar", "cuidado", "antes de"],
      answer: "Para un resultado perfecto: llega con el **rostro limpio e hidratado**, **sin base ni maquillaje previo**. Así la piel recibe mejor los productos y el maquillaje dura mucho más. 💧 ¿Ya tienes tu fecha? ¡Agendemos! ✨"
    },
    {
      keys: ["domicilio", "casa", "a domicilio", "vienen", "van a", "traslado"],
      answer: "🚗 ¡Sí! Tenemos servicio a domicilio en Guayaquil con un **costo adicional según tu zona**. Dayana te confirma el valor exacto por WhatsApp según tu ubicación. ¿Le escribimos?",
      handoff: true
    },
    {
      keys: ["precio", "precios", "cuanto cuesta", "cuánto cuesta", "costo", "valor", "tarifa", "cuanto vale", "cuánto vale"],
      weight: 0.5,
      answer: "💰 Nuestros precios:\n• 🌸 Social o Graduación: **$25**\n• 👑 XV Añeras: **$35**\n• 💍 Novias: **$50**\n• 📸 Sesión de Fotos: **$60**\n• 🎓 Clases: **$10 por clase** (12 clases) + matrícula **$15**\nA domicilio tiene costo adicional. ¿Cuál te gustaría agendar? ✨"
    },
    {
      keys: ["disponib", "fecha", "horario", "hoy", "mañana", "sabado", "sábado", "domingo", "cupo", "agenda", "agendar", "cita", "reservar"],
      weight: 0.5,
      answer: "¡Me encanta que quieras agendar! 💕 La disponibilidad de fechas y horarios la confirma Dayana personalmente. Escríbele por WhatsApp y te responde enseguida.",
      handoff: true
    },
    {
      keys: ["donde", "dónde", "direccion", "dirección", "ubicacion", "ubicación", "local", "estudio"],
      answer: "Estamos en **Guayaquil, Ecuador** 📍 y también atendemos a domicilio (con costo adicional según tu zona). Dayana te comparte la ubicación exacta al agendar.",
      handoff: true
    },
    {
      keys: ["instagram", "redes", "contacto", "telefono", "teléfono", "whatsapp", "numero", "número"],
      weight: 0.5,
      answer: "Puedes escribirle a Dayana por WhatsApp al **0981943602** o seguirnos en Instagram **@makeup_jhada** 💕 ¿Te ayudo con algo más?",
      handoff: true
    },
    {
      keys: ["hola", "buenas", "buenos dias", "buenos días", "buenas tardes", "hey", "saludos"],
      weight: 0.3,
      answer: "¡Hola, hermosa! 💕 Soy Jhada, la asistente de belleza de Dayana. Puedo contarte sobre nuestros servicios, precios, clases o ayudarte a elegir el look perfecto. ¿Qué evento tienes?"
    },
    {
      keys: ["gracias", "genial", "perfecto", "excelente"],
      weight: 0.3,
      answer: "¡Con mucho gusto! 💕 Cuando quieras, Dayana te espera para crear tu mejor versión. ¿Agendamos? ✨",
      handoff: true
    }
  ];

  function normalize(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function localAnswer(text) {
    var t = normalize(text);
    var best = null, bestScore = 0;
    KNOWLEDGE.forEach(function (item) {
      var score = 0;
      item.keys.forEach(function (k) { if (t.indexOf(normalize(k)) !== -1) score += k.length; });
      score *= item.weight || 1;
      if (score > bestScore) { bestScore = score; best = item; }
    });
    if (best) return { reply: best.answer, handoff: !!best.handoff };
    return {
      reply: "¡Buena pregunta! 💕 Para darte la información exacta, lo mejor es que lo converses directamente con Dayana. Mientras tanto, puedo contarte sobre precios, servicios, clases o cómo preparar tu piel.",
      handoff: true
    };
  }

  var AVAILABILITY_RE = /disponib|fecha|hoy|manana|sabado|domingo|lunes|martes|miercoles|jueves|viernes|cupo|horario|a que hora|que hora/;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function formatReply(text) {
    var html = escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/^\s*[-*]\s+/gm, "• ");
    return html.split(/\n{2,}/).map(function (p) { return "<p>" + p.replace(/\n/g, "<br>") + "</p>"; }).join("");
  }

  function initChat() {
    var fab = $("#chatFab");
    var panel = $("#chatPanel");
    var body = $("#chatBody");
    var form = $("#chatForm");
    var input = $("#chatInput");
    var chips = $("#chatChips");
    var closeBtn = $("#chatClose");
    if (!fab || !panel || !body || !form || !input) return;

    var history = [];
    var started = false;
    var busy = false;

    function scrollDown() { body.scrollTop = body.scrollHeight; }

    function addMsg(role, text, handoff) {
      var el = document.createElement("div");
      el.className = "msg msg--" + (role === "user" ? "user" : "bot");
      if (role === "user") el.textContent = text;
      else el.innerHTML = formatReply(text);
      if (handoff) {
        var a = document.createElement("a");
        a.className = "msg__wa";
        a.href = WA_DIRECT;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "💬 Hablar directamente con Dayana";
        el.appendChild(a);
      }
      body.appendChild(el);
      scrollDown();
    }

    function typing(on) {
      var t = $(".msg--typing", body);
      if (on && !t) {
        t = document.createElement("div");
        t.className = "msg msg--bot msg--typing";
        t.setAttribute("aria-label", "Jhada está escribiendo");
        t.innerHTML = "<i></i><i></i><i></i>";
        body.appendChild(t);
        scrollDown();
      } else if (!on && t) {
        t.remove();
      }
    }

    function open() {
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      fab.setAttribute("aria-expanded", "true");
      fab.classList.add("seen");
      if (!started) {
        started = true;
        var hello = "¡Hola, hermosa! 💕 Soy **Jhada**, la asistente de belleza de Dayana.\nTe ayudo a elegir tu look, te cuento precios, qué incluye cada servicio y todo sobre las clases. ¿Qué evento tienes?";
        addMsg("bot", hello);
        history.push({ role: "assistant", text: hello });
      }
      setTimeout(function () { if (window.innerWidth > 520) input.focus(); }, 300);
    }
    function close() {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      fab.setAttribute("aria-expanded", "false");
    }

    fab.addEventListener("click", function () { panel.classList.contains("is-open") ? close() : open(); });
    if (closeBtn) closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("is-open")) close(); });

    function askServer(message) {
      var controller = ("AbortController" in window) ? new AbortController() : null;
      var timer = setTimeout(function () { if (controller) controller.abort(); }, 30000);
      return fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message, history: history.slice(-10) }),
        signal: controller ? controller.signal : undefined
      }).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      }).then(function (data) {
        if (!data || data.fallback || !data.reply) throw new Error("fallback");
        return { reply: String(data.reply), handoff: !!data.handoff };
      });
    }

    function send(text) {
      text = String(text || "").trim();
      if (!text || busy) return;
      busy = true;
      form.querySelector("button").disabled = true;
      addMsg("user", text);
      input.value = "";
      typing(true);

      var wantsAvailability = AVAILABILITY_RE.test(normalize(text));
      var start = Date.now();

      askServer(text).catch(function () { return localAnswer(text); }).then(function (res) {
        var wait = Math.max(0, 600 - (Date.now() - start));
        setTimeout(function () {
          typing(false);
          var handoff = res.handoff || wantsAvailability;
          addMsg("bot", res.reply, handoff);
          history.push({ role: "user", text: text });
          history.push({ role: "assistant", text: res.reply });
          busy = false;
          form.querySelector("button").disabled = false;
        }, wait);
      });
    }

    form.addEventListener("submit", function (e) { e.preventDefault(); send(input.value); });
    if (chips) {
      $$("button", chips).forEach(function (b) {
        b.addEventListener("click", function () { if (!started) open(); send(b.textContent); });
      });
    }
  }

  function boot() {
    safe(initNav, "nav");
    safe(initReveals, "reveals");
    safe(initCounters, "counters");
    safe(initParallax, "parallax");
    safe(initBeforeAfter, "beforeAfter");
    safe(initFaq, "faq");
    safe(initChat, "chat");
    document.documentElement.classList.add("is-ready");
  }

  // Red de seguridad: si algo falla, el contenido se muestra igual
  setTimeout(function () {
    $$(".reveal:not(.is-visible)").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) el.classList.add("is-visible");
    });
  }, 2500);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
