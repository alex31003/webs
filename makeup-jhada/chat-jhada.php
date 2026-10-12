<?php
// =============================================================================
// chat-jhada.php — asistente "Jhada ✨" de Makeup Jhada Beauty Studio
// Conecta el chat de la web con la API de Claude (Anthropic).
//
// El navegador SOLO habla con este archivo (mismo dominio). La clave de Claude
// vive aquí, en el servidor, y NUNCA se envía a quien visita la web.
//
// Si no hay clave o Claude no responde, este archivo devuelve {"fallback":true}
// y el chat usa automáticamente sus respuestas preparadas (main.js), así nunca
// queda "muerto".
// =============================================================================

// ============================================================
// <!-- INSERTAR API KEY DE CLAUDE AQUÍ -->
// Pega tu clave entre las comillas (empieza por "sk-ant-").
// Se consigue en https://console.anthropic.com → API Keys.
// Opción más segura: deja esto vacío y crea un archivo llamado
// claude_api_key.php UNA carpeta por encima de public_html con:
//     <?php return 'sk-ant-...';
// ============================================================
$CLAUDE_API_KEY = ''; // INSERTAR API KEY DE CLAUDE AQUÍ

// Modelo de Claude. Para abaratar costos puedes cambiarlo por 'claude-haiku-5-5'.
$CLAUDE_MODEL = 'claude-opus-5-5';

// Límites para proteger tu saldo de uso indebido
$PER_MIN    = 8;    // mensajes por persona (IP) por minuto
$PER_DAY    = 80;   // mensajes por persona (IP) por día
$GLOBAL_DAY = 1000; // mensajes totales por día en toda la web

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function out($arr) {
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}
function fallback() { out(['fallback' => true]); }
function say($text, $handoff = false) { out(['reply' => $text, 'handoff' => $handoff]); }

// --- Solo POST ---
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  out(['error' => 'method']);
}

// --- Solo desde esta misma web (evita que otros sitios gasten tu saldo) ---
$host = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
$src  = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
if ($src !== '') {
  $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
  if ($srcHost === '' || $srcHost !== $host) {
    http_response_code(403);
    out(['error' => 'origin']);
  }
}

// --- Clave: este archivo -> variable de entorno -> archivo fuera de public_html ---
$key = trim((string) $CLAUDE_API_KEY);
if ($key === '') { $key = (string) getenv('ANTHROPIC_API_KEY'); }
if ($key === '' && is_file(__DIR__ . '/../claude_api_key.php')) {
  $k = @include __DIR__ . '/../claude_api_key.php';
  if (is_string($k)) $key = trim($k);
}
if ($key === '' || !function_exists('curl_init')) {
  fallback(); // sin clave: el chat usa sus respuestas preparadas
}

// --- Entrada ---
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
$message = trim((string) ($in['message'] ?? ''));
$history = is_array($in['history'] ?? null) ? array_slice($in['history'], -10) : [];
if ($message === '' || mb_strlen($message) > 500) {
  http_response_code(400);
  out(['error' => 'input']);
}

// --- Límites por IP y global (archivos temporales del servidor) ---
$ip    = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$tmp   = sys_get_temp_dir();
$now   = time();
$ipFile = $tmp . '/jhada_rl_' . md5($ip) . '.json';
$stamps = is_file($ipFile) ? json_decode((string) @file_get_contents($ipFile), true) : [];
if (!is_array($stamps)) $stamps = [];
$lastMin = count(array_filter($stamps, function ($t) use ($now) { return $t > $now - 60; }));
$lastDay = count(array_filter($stamps, function ($t) use ($now) { return $t > $now - 86400; }));
if ($lastMin >= $PER_MIN) say('¡Vas muy rápido, hermosa! 🙂 Espera unos segundos y vuelve a preguntarme.');
if ($lastDay >= $PER_DAY) say('Hoy ya conversamos bastante 💕 Para seguir, escríbele directamente a Dayana por WhatsApp.', true);

$gFile  = $tmp . '/jhada_rl_global_' . date('Ymd') . '.txt';
$gCount = is_file($gFile) ? (int) @file_get_contents($gFile) : 0;
if ($gCount >= $GLOBAL_DAY) fallback();

$stamps[] = $now;
@file_put_contents($ipFile, json_encode(array_slice(array_values($stamps), -200)), LOCK_EX);
@file_put_contents($gFile, (string) ($gCount + 1), LOCK_EX);

// --- Personalidad y conocimiento de Jhada ---
$system = <<<TXT
Eres «Jhada ✨», la asistente de belleza virtual de Makeup Jhada Beauty Studio, el estudio de Dayana Peñafiel, maquilladora profesional desde 2021 en Guayaquil, Ecuador. Atiendes el chat de su página web.

TONO: cálido, profesional y femenino, como una amiga experta en belleza. Español latino neutro (Ecuador). Puedes llamar a la clienta «hermosa» o «linda» de vez en cuando. Usa 1–2 emojis por respuesta como máximo (💕 ✨ 👑 💍 🌸 📸 🎓). Respuestas breves: 2 a 6 líneas. Para listas usa líneas que empiecen con «• ». Puedes resaltar con **negritas**. No uses títulos ni tablas.

SERVICIOS Y PRECIOS REALES (no existen otros; nunca inventes precios, descuentos, promociones ni servicios distintos):
• 🌸 Social o Graduación — $25: limpieza facial, maquillaje, pestañas, peinado (ondas o planchado). Duración aprox. 1.5 horas. A domicilio: costo adicional.
• 👑 XV Añeras — $35: limpieza facial, maquillaje, piel blindada, técnica de fondeo, pestañas, peinado. Duración aprox. 2 horas. A domicilio: costo adicional.
• 💍 Novias — $50: limpieza facial, exfoliación, hidratación, maquillaje, piel blindada, pestañas, peinado. Duración aprox. 2.5 horas. A domicilio: costo adicional.
• 📸 Sesión de Fotos — $60: limpieza facial, maquillaje, piel blindada, técnica strobing, backstage de 2 horas, pestañas, peinado. Duración aprox. 3 horas con backstage.
• 🎓 Clases de Makeup Avanzado: 12 clases a $10 cada una + matrícula de $15 (12 × $10 = $120, más $15 de matrícula). Incluyen GRATIS: camiseta, paleta de sombras, plantillas, materiales por clase, refrigerios, sesión de fotos profesional, clases de peinado y certificación oficial al completar las 12 clases.

TÉCNICAS:
• Strobing: iluminación estratégica de los puntos altos del rostro; se ve espectacular en fotos.
• Fondeo: base trabajada para una piel uniforme y de larga duración.
• Piel blindada: fijación total; el maquillaje dura muchas más horas, ideal para eventos largos (resiste calor y lágrimas de emoción).
• Glam: look con más dramatismo, ojos intensos y acabado impactante.

OTROS DATOS:
• Cómo preparar la piel: llegar con el rostro limpio e hidratado, sin base ni maquillaje previo.
• Servicio a domicilio: disponible en Guayaquil con costo adicional según la zona; el valor exacto lo confirma Dayana.
• Contacto: WhatsApp 0981943602 · Instagram @makeup_jhada.

CÓMO RECOMENDAR: si la clienta cuenta su evento o presupuesto, recomienda el paquete adecuado (graduación/cumpleaños → Social $25; quince años → XV $35; boda → Novias $50; book o sesión fotográfica → Sesión de Fotos $60; quiere aprender → Clases). Explica en una frase por qué le conviene.

REGLAS:
1. Solo hablas de maquillaje, belleza y los servicios del estudio. Si preguntan otra cosa, redirige con amabilidad.
2. Nunca inventes datos que no estén aquí (fechas libres, dirección exacta, horarios, costo exacto del domicilio, productos de marcas, promociones).
3. Termina SIEMPRE invitando a agendar (por ejemplo: «¿Agendamos tu look con Dayana? ✨»).
4. Si la clienta pregunta por disponibilidad, fechas, horarios, el costo exacto a domicilio, algo que no sabes, o pide hablar con una persona: dile con cariño que Dayana se lo confirma personalmente por WhatsApp y escribe al final de tu respuesta, en una línea aparte, exactamente: [DAYANA]
TXT;

// --- Historial en formato Claude (debe empezar por "user" y alternar roles) ---
$messages = [];
foreach ($history as $h) {
  $role = (($h['role'] ?? '') === 'assistant') ? 'assistant' : 'user';
  $text = trim(mb_substr((string) ($h['text'] ?? ''), 0, 1200));
  if ($text === '') continue;
  if (empty($messages) && $role === 'assistant') continue; // el saludo inicial no hace falta
  $last = count($messages) - 1;
  if ($last >= 0 && $messages[$last]['role'] === $role) {
    $messages[$last]['content'] .= "\n\n" . $text;
  } else {
    $messages[] = ['role' => $role, 'content' => $text];
  }
}
if (!empty($messages) && end($messages)['role'] === 'user') {
  $messages[count($messages) - 1]['content'] .= "\n\n" . $message;
} else {
  $messages[] = ['role' => 'user', 'content' => $message];
}

// --- Llamada a la API de Claude ---
$payload = [
  'model'         => $CLAUDE_MODEL,
  'max_tokens'    => 2000,
  'system'        => $system,
  'messages'      => $messages,
  'output_config' => ['effort' => 'low'], // chat: respuestas rápidas
];
$headers = [
  'content-type: application/json',
  'x-api-key: ' . $key,
  'anthropic-version: 2023-06-01',
];
// Si el modelo rechaza una consulta por seguridad, Anthropic la reintenta con otro modelo
if (strpos($CLAUDE_MODEL, 'claude-opus-5') === 0) {
  $payload['fallbacks'] = 'default';
  $headers[] = 'anthropic-beta: server-side-fallback-2026-07-01';
}

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST           => true,
  CURLOPT_HTTPHEADER     => $headers,
  CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
  CURLOPT_CONNECTTIMEOUT => 10,
  CURLOPT_TIMEOUT        => 28,
]);
$resp = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

if ($resp === false || $code >= 400) {
  @error_log('[jhada-chat] http ' . $code . ' ' . $err . ' ' . substr((string) $resp, 0, 300));
  fallback();
}

$data = json_decode($resp, true);
if (!is_array($data) || ($data['stop_reason'] ?? '') === 'refusal') {
  say('Esa consulta prefiero que la veas directamente con Dayana 💕 Ella te responde enseguida por WhatsApp.', true);
}

// Unir solo los bloques de texto (puede haber bloques de razonamiento vacíos)
$reply = '';
foreach (($data['content'] ?? []) as $block) {
  if (($block['type'] ?? '') === 'text') $reply .= $block['text'];
}
$reply = trim($reply);
if ($reply === '') fallback();

$handoff = false;
if (strpos($reply, '[DAYANA]') !== false) {
  $handoff = true;
  $reply = trim(str_replace('[DAYANA]', '', $reply));
}

say($reply, $handoff);
