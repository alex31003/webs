<?php
// config.php — datos reales del negocio (fuente única de verdad).
// Los precios de aquí son los ÚNICOS que el asistente y el planificador pueden
// mencionar. Si cambian los precios, cámbialos aquí y en lib/manifest.js.
//
// Campos marcados con 'ejemplo' => true son DATOS DE EJEMPLO hasta tener los reales.

return [
  'negocio' => [
    'nombre'     => 'Makeup Jhada Beauty Studio',
    'artista'    => 'Dayana Peñafiel',
    'desde'      => 2021,
    'ciudad'     => 'Guayaquil, Ecuador',
    'whatsapp'   => '0981943602',
    'whatsapp_intl' => '593981943602',
    'instagram'  => '@makeup_jhada',
    'instagram_url' => 'https://instagram.com/makeup_jhada',
    // DATOS DE EJEMPLO — reemplazar por los reales
    'direccion'  => ['texto' => 'Norte de Guayaquil (dirección exacta al agendar)', 'ejemplo' => true],
    'horario'    => ['texto' => 'Lunes a sábado 08:00–19:00 · Domingos con cita previa', 'ejemplo' => true],
  ],

  'servicios' => [
    'social' => [
      'nombre'   => 'Social o Graduación',
      'precio'   => 25,
      'incluye'  => ['Limpieza facial', 'Maquillaje', 'Pestañas', 'Peinado (ondas o planchado)'],
      'domicilio'=> 'A domicilio tiene costo adicional',
      'duracion' => 'aprox. 1 h 15 min',          // estimación de ejemplo, confirmar con Dayana
    ],
    'xv' => [
      'nombre'   => 'XV Añeras',
      'precio'   => 35,
      'incluye'  => ['Limpieza facial', 'Maquillaje', 'Piel blindada', 'Técnica de fondeo', 'Pestañas', 'Peinado (ondas o planchado)'],
      'domicilio'=> 'A domicilio tiene costo adicional',
      'duracion' => 'aprox. 1 h 45 min',          // estimación de ejemplo
    ],
    'novia' => [
      'nombre'   => 'Novias',
      'precio'   => 50,
      'incluye'  => ['Limpieza facial', 'Exfoliación', 'Hidratación', 'Maquillaje', 'Piel blindada', 'Pestañas', 'Peinado (ondas o planchado)'],
      'domicilio'=> 'A domicilio tiene costo adicional',
      'duracion' => 'aprox. 2 h 30 min',          // estimación de ejemplo
    ],
    'fotos' => [
      'nombre'   => 'Sesión de Fotos',
      'precio'   => 60,
      'incluye'  => ['Limpieza facial', 'Maquillaje', 'Piel blindada', 'Técnica strobing', 'Backstage 2 h', 'Pestañas', 'Peinado (ondas o planchado)'],
      'domicilio'=> 'Consultar disponibilidad a domicilio por WhatsApp',
      'duracion' => 'aprox. 1 h 30 min de maquillaje + 2 h de backstage',  // estimación de ejemplo
    ],
  ],

  'clases' => [
    'nombre'     => 'Clases de Makeup Avanzado',
    'num_clases' => 12,
    'precio_clase' => 10,
    'matricula'  => 15,
    'total'      => 135, // 12 × $10 + $15 de matrícula
    'incluye_gratis' => ['Camiseta', 'Paleta de sombras', 'Plantillas', 'Materiales faltantes por clase', 'Refrigerios', 'Sesión de fotos profesional', 'Clases de peinado', 'Certificación oficial'],
  ],

  // Ajustes de la IA
  'ia' => [
    'modelo'        => 'claude-opus-5-5',  // alternativa más económica: 'claude-haiku-5-5'
    'esfuerzo_chat' => 'low',
    'esfuerzo_plan' => 'low',
    // Límites para proteger el saldo de la cuenta de IA
    'chat_por_minuto' => 8,
    'chat_por_dia'    => 80,
    'plan_por_minuto' => 3,
    'plan_por_dia'    => 15,
    'tope_global_dia' => 1500,
  ],
];
