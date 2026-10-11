<?php
// asistente-ia.php — el asistente «Fiel» de Amigo Fiel (Google Gemini, capa gratuita).
// El navegador solo habla con este archivo. La clave vive en el servidor y nunca se envía al navegador.
require __DIR__ . '/ia-comun.php';
af_json_headers();

function reply_json($text) { af_out(['reply' => $text]); }

af_guard_post();

$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
$message = trim((string) ($in['message'] ?? ''));
$history = is_array($in['history'] ?? null) ? array_slice($in['history'], -8) : [];
if ($message === '' || mb_strlen($message) > 500) af_out(['error' => 'input'], 400);

$rate = af_rate('chat', 8, 100, 1200);
if ($rate === 'rate_min')    reply_json('Vas muy rápido 🙂 Espera unos segundos y vuelve a preguntarme. Si es una urgencia, llama ya al 600 000 000.');
if ($rate === 'rate_day')    reply_json('Hoy ya me has hecho muchas preguntas. Para seguir, llámanos al 600 000 000 o pide cita desde la web y te atendemos encantados.');
if ($rate === 'rate_global') reply_json('Ahora mismo estoy muy solicitado. Llámanos al 600 000 000 o pide cita desde la web. Si es una urgencia, llama ya.');

$key = af_gemini_key();
if ($key === '') reply_json('Todavía me estoy terminando de configurar 🐾 Mientras tanto, llámanos al 600 000 000 o pide cita desde la web. Si es una urgencia, llama ya: atendemos 24 h.');

$system = @include __DIR__ . '/knowledge.php';
if (!is_string($system) || $system === '') {
  $system = 'Eres «Fiel», el asistente de la clínica veterinaria Amigo Fiel. Responde en español, breve y cercano, solo sobre cuidado de perros y gatos. No sustituyes a una consulta. Ante urgencias, indica llamar ya al 600 000 000.';
}

$contents = [];
foreach ($history as $h) {
  $role = (($h['role'] ?? '') === 'model') ? 'model' : 'user';
  $text = mb_substr((string) ($h['text'] ?? ''), 0, 1200);
  if ($text === '') continue;
  $contents[] = ['role' => $role, 'parts' => [['text' => $text]]];
}
$contents[] = ['role' => 'user', 'parts' => [['text' => $message]]];

$payload = [
  'system_instruction' => ['parts' => [['text' => $system]]],
  'contents'           => $contents,
  'generationConfig'   => ['temperature' => 0.4, 'topP' => 0.9, 'maxOutputTokens' => 700],
  'safetySettings'     => af_safety(),
];

list($reply, $err) = af_gemini($key, $payload);
if ($reply === '') {
  @error_log('[amigofiel-chat] ' . $err);
  reply_json('Ahora mismo no puedo responder. Llámanos al 600 000 000 o pide cita desde la web. Si es una urgencia, llama ya: atendemos 24 h.');
}
reply_json(trim($reply));
