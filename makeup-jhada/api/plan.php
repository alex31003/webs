<?php
// plan.php — Planificador de Look Personalizado (Claude).
// El PAQUETE y el PRECIO los decide este archivo con los datos reales de
// config.php; la IA solo propone la paleta, las técnicas y los consejos.

require __DIR__ . '/_base.php';
guard_request();

$in = read_json_body();
$EVENTOS = ['boda', 'quinceanera', 'graduacion', 'fotos', 'social', 'glam', 'otro'];
$TONOS   = ['clara', 'media', 'morena', 'oscura'];
$ESTILOS = ['natural', 'romantico', 'glam', 'dramatico', 'novia_clasica'];

$evento = in_array($in['evento'] ?? '', $EVENTOS, true) ? $in['evento'] : 'otro';
$tono   = in_array($in['tono'] ?? '', $TONOS, true) ? $in['tono'] : 'media';
$estilo = in_array($in['estilo'] ?? '', $ESTILOS, true) ? $in['estilo'] : 'natural';
$presupuesto = max(20, min(100, (int) ($in['presupuesto'] ?? 50)));
$peinado = !empty($in['peinado']);
$domicilio = (($in['lugar'] ?? '') === 'domicilio');
$interesClases = !empty($in['clases']);
$otroTexto = trim(mb_substr((string) ($in['otro'] ?? ''), 0, 120));
$fecha = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($in['fecha'] ?? '')) ? $in['fecha'] : '';

// --- Paquete recomendado (determinista, precios reales) ---
$MAPA = ['boda' => 'novia', 'quinceanera' => 'xv', 'graduacion' => 'social', 'fotos' => 'fotos', 'social' => 'social', 'glam' => 'social', 'otro' => 'social'];
$clave = $MAPA[$evento];
if ($evento === 'otro' && $estilo === 'novia_clasica') $clave = 'novia';
$S = $CFG['servicios'];
$pack = $S[$clave];

$notas = [];
$alternativa = null;
if ($presupuesto < $pack['precio']) {
  if ($clave !== 'social' && $presupuesto >= $S['social']['precio']) {
    $alternativa = ['clave' => 'social', 'nombre' => $S['social']['nombre'], 'precio' => $S['social']['precio']];
    $notas[] = "Tu presupuesto aproximado (\${$presupuesto}) está por debajo del paquete ideal. Una alternativa real es {$S['social']['nombre']} (\${$S['social']['precio']}). Dayana puede orientarte sobre cuál te conviene.";
  } else {
    $notas[] = "Tu presupuesto aproximado (\${$presupuesto}) está un poco por debajo de este paquete. Escríbele a Dayana y te orienta sin compromiso.";
  }
}
if ($domicilio) {
  $notas[] = ($clave === 'fotos')
    ? 'Para la sesión de fotos a domicilio, consulta disponibilidad y costo por WhatsApp.'
    : 'Elegiste a domicilio: tiene un costo adicional que depende de tu sector y se confirma por WhatsApp.';
}
if (!$peinado) {
  $notas[] = 'Todos los paquetes ya incluyen peinado (ondas o planchado). Si no lo necesitas, coméntaselo a Dayana al agendar.';
}
$diasFaltan = null;
if ($fecha !== '') {
  $diasFaltan = (int) floor((strtotime($fecha . ' 12:00') - time()) / 86400);
  if ($diasFaltan >= 0 && $diasFaltan <= 7) $notas[] = 'Tu evento es muy pronto: agenda cuanto antes para asegurar tu horario.';
}
$recomendarClases = $interesClases || $presupuesto >= 100;
$C = $CFG['clases'];

$base = [
  'ok' => true,
  'paquete' => ['clave' => $clave, 'nombre' => $pack['nombre'], 'precio' => $pack['precio'], 'incluye' => $pack['incluye'], 'duracion' => $pack['duracion']],
  'alternativa' => $alternativa,
  'domicilio' => $domicilio,
  'notas' => $notas,
  'clases' => $recomendarClases ? ['nombre' => $C['nombre'], 'detalle' => "{$C['num_clases']} clases · \${$C['precio_clase']} por clase · matrícula \${$C['matricula']}", 'incluye' => $C['incluye_gratis']] : null,
  'ia' => null,
];

$ia = $CFG['ia'];
$rl = rate_limit('plan', $ia['plan_por_minuto'], $ia['plan_por_dia'], $ia['tope_global_dia']);
$client = ($rl === null) ? make_client() : null;
if ($client === null) out($base); // el navegador completa la paleta con su guía local

$NOMBRES_EVENTO = ['boda' => 'boda (es la novia)', 'quinceanera' => 'quinceañera (es la quinceañera)', 'graduacion' => 'graduación', 'fotos' => 'sesión de fotos', 'social' => 'evento social', 'glam' => 'evento glam de noche', 'otro' => 'otro evento' . ($otroTexto !== '' ? ": {$otroTexto}" : '')];
$NOMBRES_ESTILO = ['natural' => 'natural', 'romantico' => 'romántico', 'glam' => 'glam', 'dramatico' => 'dramático', 'novia_clasica' => 'novia clásica'];

$tecnicasPaquete = array_values(array_intersect($pack['incluye'], ['Piel blindada', 'Técnica de fondeo', 'Técnica strobing']));
$system = "Eres la maquilladora experta de Makeup Jhada Beauty Studio (Guayaquil, Ecuador). Diseñas planes de look orientativos, en español, cálidos y profesionales. Clima de Guayaquil: cálido y húmedo, piensa en durabilidad. No menciones precios ni paquetes (eso lo pone el sistema). No prometas resultados: es una propuesta orientativa que Dayana ajustará al rostro real.";

$prompt = "Crea un plan de look para esta clienta:\n"
  . "- Evento: {$NOMBRES_EVENTO[$evento]}\n"
  . "- Tono de piel: {$tono}\n"
  . "- Estilo preferido: {$NOMBRES_ESTILO[$estilo]}\n"
  . "- Peinado: " . ($peinado ? 'sí' : 'no') . "\n"
  . "- Paquete asignado: {$pack['nombre']} (incluye: " . implode(', ', $pack['incluye']) . ")\n"
  . ($tecnicasPaquete ? "- Técnicas del paquete que DEBEN aparecer en la lista de técnicas: " . implode(', ', $tecnicasPaquete) . "\n" : '')
  . ($diasFaltan !== null && $diasFaltan >= 0 ? "- Faltan {$diasFaltan} días para el evento\n" : '')
  . "\nDevuelve: un nombre evocador para el look (máx. 5 palabras); un resumen de 2 frases; una paleta de 5 colores (nombre poético en español, color hex #RRGGBB favorecedor para ese tono de piel y estilo, y dónde se usa: ojos, labios, mejillas, iluminador o base); de 3 a 5 técnicas (por ejemplo strobing, fondeo, piel blindada, ahumado, cat eye, cut crease, baking) con una frase de por qué; una línea para ojos, una para labios y una para piel; un peinado sugerido (ondas o planchado, que son los incluidos)" . ($peinado ? '' : ' o "Sin peinado"') . "; y 3 consejos de preparación (incluye llegar con la piel limpia, hidratada y sin base).";

$schema = [
  'type' => 'object',
  'properties' => [
    'titulo'   => ['type' => 'string'],
    'resumen'  => ['type' => 'string'],
    'paleta'   => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['nombre' => ['type' => 'string'], 'hex' => ['type' => 'string'], 'uso' => ['type' => 'string']], 'required' => ['nombre', 'hex', 'uso'], 'additionalProperties' => false]],
    'tecnicas' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['nombre' => ['type' => 'string'], 'porque' => ['type' => 'string']], 'required' => ['nombre', 'porque'], 'additionalProperties' => false]],
    'ojos'     => ['type' => 'string'],
    'labios'   => ['type' => 'string'],
    'piel'     => ['type' => 'string'],
    'peinado'  => ['type' => 'string'],
    'consejos' => ['type' => 'array', 'items' => ['type' => 'string']],
  ],
  'required' => ['titulo', 'resumen', 'paleta', 'tecnicas', 'ojos', 'labios', 'piel', 'peinado', 'consejos'],
  'additionalProperties' => false,
];

try {
  $resp = $client->messages->create(
    model: $ia['modelo'],
    maxTokens: 4000,
    system: $system,
    messages: [['role' => 'user', 'content' => $prompt]],
    outputConfig: ['effort' => $ia['esfuerzo_plan'], 'format' => ['type' => 'json_schema', 'schema' => $schema]],
  );
  if ($resp->stopReason !== 'end_turn') out($base);
  $d = json_decode(first_text($resp), true);
  if (!is_array($d)) out($base);

  $s = fn($v, $max = 400) => trim(mb_substr(is_string($v) ? $v : '', 0, $max));
  $paleta = [];
  foreach (array_slice((array) ($d['paleta'] ?? []), 0, 6) as $p) {
    $hex = strtoupper($s($p['hex'] ?? '', 7));
    if (!preg_match('/^#[0-9A-F]{6}$/', $hex)) continue;
    $paleta[] = ['nombre' => $s($p['nombre'] ?? '', 40), 'hex' => $hex, 'uso' => $s($p['uso'] ?? '', 60)];
  }
  $tecnicas = [];
  foreach (array_slice((array) ($d['tecnicas'] ?? []), 0, 5) as $t) {
    $tecnicas[] = ['nombre' => $s($t['nombre'] ?? '', 40), 'porque' => $s($t['porque'] ?? '', 200)];
  }
  $base['ia'] = [
    'titulo' => $s($d['titulo'] ?? '', 60),
    'resumen' => $s($d['resumen'] ?? '', 400),
    'paleta' => $paleta,
    'tecnicas' => $tecnicas,
    'ojos' => $s($d['ojos'] ?? ''), 'labios' => $s($d['labios'] ?? ''), 'piel' => $s($d['piel'] ?? ''),
    'peinado' => $s($d['peinado'] ?? '', 200),
    'consejos' => array_map(fn($c) => $s($c, 200), array_slice((array) ($d['consejos'] ?? []), 0, 4)),
  ];
  out($base);
} catch (\Throwable $e) {
  log_err('plan', $e);
  out($base);
}
