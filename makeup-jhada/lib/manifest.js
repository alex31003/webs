(function () {
  "use strict";
  // Datos de la marca para el navegador. Los precios deben coincidir con api/config.php.
  window.__BRAND__ = {
    name: "Makeup Jhada Beauty Studio",
    whatsapp: "0981943602",
    whatsappIntl: "593981943602",
    instagram: "@makeup_jhada",
    instagramUrl: "https://instagram.com/makeup_jhada",

    servicios: {
      social: { nombre: "Social o Graduación", precio: 25, duracion: "aprox. 1 h 15 min",
        incluye: ["Limpieza facial", "Maquillaje", "Pestañas", "Peinado (ondas o planchado)"] },
      xv: { nombre: "XV Añeras", precio: 35, duracion: "aprox. 1 h 45 min",
        incluye: ["Limpieza facial", "Maquillaje", "Piel blindada", "Técnica de fondeo", "Pestañas", "Peinado (ondas o planchado)"] },
      novia: { nombre: "Novias", precio: 50, duracion: "aprox. 2 h 30 min",
        incluye: ["Limpieza facial", "Exfoliación", "Hidratación", "Maquillaje", "Piel blindada", "Pestañas", "Peinado (ondas o planchado)"] },
      fotos: { nombre: "Sesión de Fotos", precio: 60, duracion: "aprox. 1 h 30 min + 2 h de backstage",
        incluye: ["Limpieza facial", "Maquillaje", "Piel blindada", "Técnica strobing", "Backstage 2 h", "Pestañas", "Peinado (ondas o planchado)"] }
    },
    clases: { nombre: "Clases de Makeup Avanzado", detalle: "12 clases · $10 por clase · matrícula $15",
      incluye: ["Camiseta", "Paleta de sombras", "Plantillas", "Materiales faltantes por clase", "Refrigerios", "Sesión de fotos profesional", "Clases de peinado", "Certificación oficial"] },

    // Guía local del planificador (se usa si la IA no está disponible)
    eventoAPaquete: { boda: "novia", quinceanera: "xv", graduacion: "social", fotos: "fotos", social: "social", glam: "social", otro: "social" },
    nombresEvento: { boda: "Boda", quinceanera: "Quinceañera", graduacion: "Graduación", fotos: "Sesión de fotos", social: "Evento social", glam: "Glam de noche", otro: "Otro evento" },
    nombresEstilo: { natural: "Natural", romantico: "Romántico", glam: "Glam", dramatico: "Dramático", novia_clasica: "Novia clásica" },
    paletas: {
      clara:  [["Champagne", "#E9CFA3", "Iluminador"], ["Rosa té", "#D9A3A0", "Mejillas"], ["Taupe suave", "#9C8072", "Ojos"], ["Bronce rosado", "#B07B5E", "Ojos"], ["Nude malva", "#C48B8B", "Labios"]],
      media:  [["Oro miel", "#D6AE62", "Iluminador"], ["Durazno tostado", "#D08A6A", "Mejillas"], ["Cobre", "#A8603A", "Ojos"], ["Chocolate", "#5C3424", "Ojos"], ["Rosa canela", "#B5675F", "Labios"]],
      morena: [["Oro antiguo", "#C9A84C", "Iluminador"], ["Terracota", "#B5603F", "Mejillas"], ["Bronce", "#8C5A2B", "Ojos"], ["Espresso", "#3D1C1C", "Ojos"], ["Vino suave", "#8A3B45", "Labios"]],
      oscura: [["Oro rosa", "#D9A066", "Iluminador"], ["Ciruela cálida", "#7A3442", "Mejillas"], ["Cobre intenso", "#9A4E25", "Ojos"], ["Cacao", "#2B1410", "Ojos"], ["Borgoña", "#6B2D3E", "Labios"]]
    },
    tecnicasEstilo: {
      natural: [["Piel glow", "Acabado luminoso y fresco que deja ver tu piel."], ["Fondeo ligero", "Base en capas finas para uniformar sin pesar."]],
      romantico: [["Difuminado suave", "Sombras en tonos cálidos sin bordes marcados."], ["Rubor drapeado", "Color en mejillas y sienes para un efecto enamorado."]],
      glam: [["Strobing", "Ilumina los puntos altos para brillar en fotos."], ["Ahumado", "Profundidad en el párpado para una mirada intensa."]],
      dramatico: [["Cut crease", "Pliegue marcado para un ojo editorial."], ["Cat eye", "Delineado felino que alarga la mirada."]],
      novia_clasica: [["Piel blindada", "Sella el maquillaje para que dure toda la celebración."], ["Ojo luminoso", "Tonos champagne y pestañas que abren la mirada."]]
    }
  };
})();
