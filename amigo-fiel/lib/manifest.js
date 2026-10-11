(function () {
  "use strict";
  // Datos de la clínica. TODO lo marcado como ejemplo se sustituirá por los datos reales.
  window.__BRAND__ = {
    name: "Amigo Fiel",
    tagline: "Cuidamos de quien siempre te espera",
    contact: {
      phone: "600 000 000",          // ejemplo
      phoneHref: "tel:+34600000000",  // ejemplo
      email: "hola@amigofiel.example",// ejemplo
      address: "Calle de la Amistad, 12 · 46001 Valencia" // ejemplo
    },
    // Zona con riesgo de leishmaniosis (costa mediterránea): activa la prevención específica en el plan.
    leishmaniaZone: true,

    // Precios orientativos de ejemplo (€, IVA incluido). El veterinario confirma en consulta.
    prices: {
      consulta: 35,
      vacPolivalente: 45,   // perro: moquillo, parvovirus, hepatitis, leptospirosis…
      vacRabia: 35,
      vacLeish: 60,
      testLeish: 40,
      vacTos: 30,           // tos de las perreras
      vacTrivalente: 40,    // gato: panleucopenia, rinotraqueitis, calicivirus
      vacFelv: 42,          // leucemia felina
      testFelv: 35,
      microchip: 40,
      despInterna: 12,      // por toma (perro mediano; se ajusta por peso)
      despExternaMes: 16,   // pipeta/comprimido mensual (se ajusta por peso)
      analitica: 75,
      analiticaSenior: 95,
      limpiezaDental: 180,
      esterilizacionPerro: 260,
      esterilizacionGato: 120
    },

    // Planes de salud anuales (cuota mensual, ejemplo).
    plans: {
      cachorro: { name: "Plan Primer Año", perro: 29, gato: 22,
        covers: ["Consultas ilimitadas", "Todas las vacunas del primer año", "Desparasitación interna", "Microchip y cartilla", "15 % dto. en esterilización", "10 % dto. en antiparasitarios externos"] },
      adulto:   { name: "Plan Adulto", perro: 22, gato: 14,
        covers: ["Consultas ilimitadas", "Revisión anual completa", "Vacunas anuales", "Desparasitación interna", "Test de leishmania (perros)", "15 % dto. en cirugía y dental", "10 % dto. en antiparasitarios externos"] },
      senior:   { name: "Plan Senior", perro: 34, gato: 26,
        covers: ["Consultas ilimitadas", "2 revisiones senior al año", "2 analíticas completas", "Vacunas anuales", "Desparasitación interna", "20 % dto. en dental", "10 % dto. en antiparasitarios externos"] }
    }
  };
})();
