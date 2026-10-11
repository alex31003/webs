<?php
// ia-comun.php — utilidades compartidas por los archivos de IA de Amigo Fiel.
// No se sirve por sí solo: lo incluyen asistente-ia.php, lector-documento.php,
// consejos-ia.php y lead.php.

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) { http_response_code(404); exit; }

const AF_PREFIX = 'amigofiel';
// Modelos de la capa gratuita de Gemini: se prueban en orden si uno falla.
const AF_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-flash-latest'];

function af_out($arr, $code = 200) {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

function af_json_headers() {
  header('Content-Type: application/json; charset=utf-8');
  header('X-Content-Type-Options: nosniff');
  header('Cache-Control: no-store');
}

// Solo POST y solo desde la propia web (evita que otras webs gasten la cuota).
function af_guard_post() {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') af_out(['ok' => false, 'reason' => 'method'], 405);
  $host = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
  $src  = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
  if ($src !== '') {
    $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
    if ($srcHost === '' || $srcHost !== $host) af_out(['ok' => false, 'reason' => 'origin'], 403);
  }
}

// Límite por IP (minuto y día) + tope global diario. Devuelve null si pasa, o el motivo.
function af_rate($bucket, $perMin, $perDay, $globalDay) {
  $ip  = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
  $tmp = sys_get_temp_dir();
  $now = time();
  $ipFile = $tmp . '/' . AF_PREFIX . '_' . $bucket . '_' . md5($ip) . '.json';
  $stamps = is_file($ipFile) ? json_decode((string) @file_get_contents($ipFile), true) : [];
  if (!is_array($stamps)) $stamps = [];
  $min = count(array_filter($stamps, function ($t) use ($now) { return $t > $now - 60; }));
  $day = count(array_filter($stamps, function ($t) use ($now) { return $t > $now - 86400; }));
  if ($min >= $perMin) return 'rate_min';
  if ($day >= $perDay) return 'rate_day';
  $gFile  = $tmp . '/' . AF_PREFIX . '_' . $bucket . '_global_' . date('Ymd') . '.txt';
  $gCount = is_file($gFile) ? (int) @file_get_contents($gFile) : 0;
  if ($globalDay > 0 && $gCount >= $globalDay) return 'rate_global';
  $stamps[] = $now;
  $stamps = array_slice(array_values(array_filter($stamps, function ($t) use ($now) { return $t > $now - 86400; })), -400);
  @file_put_contents($ipFile, json_encode($stamps), LOCK_EX);
  @file_put_contents($gFile, (string) ($gCount + 1), LOCK_EX);
  return null;
}

// Clave: variable de entorno → archivo fuera de public_html → archivo local protegido.
function af_gemini_key() {
  $key = getenv('GEMINI_API_KEY');
  if (!$key && is_file(__DIR__ . '/../gemini_api_key.php')) { $key = @include __DIR__ . '/../gemini_api_key.php'; }
  if (!$key && is_file(__DIR__ . '/secret_config.php'))     { $key = @include __DIR__ . '/secret_config.php'; }
  $key = is_string($key) ? trim($key) : '';
  return ($key !== '' && $key !== 'TU_CLAVE_AQUI') ? $key : '';
}

// Llama a Gemini probando los modelos en orden. Devuelve [texto, error].
function af_gemini($key, $payload, $models = null, $timeout = 30) {
  $models = $models ?: AF_MODELS;
  $lastErr = '';
  foreach ($models as $model) {
    $p = $payload;
    if (strpos($model, '2.5') !== false) {
      $p['generationConfig']['thinkingConfig'] = ['thinkingBudget' => 0];
    }
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST           => true,
      CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'x-goog-api-key: ' . $key],
      CURLOPT_POSTFIELDS     => json_encode($p, JSON_UNESCAPED_UNICODE),
      CURLOPT_TIMEOUT        => $timeout,
      CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($resp === false || $code >= 400) { $lastErr = "$model http $code $err " . substr((string) $resp, 0, 300); continue; }
    $data = json_decode($resp, true);
    $text = '';
    foreach (($data['candidates'][0]['content']['parts'] ?? []) as $part) {
      if (isset($part['text']) && empty($part['thought'])) $text .= $part['text'];
    }
    if (trim($text) !== '') return [$text, ''];
    $lastErr = "$model vacío (" . ($data['promptFeedback']['blockReason'] ?? ($data['candidates'][0]['finishReason'] ?? '?')) . ')';
  }
  return ['', $lastErr];
}

function af_safety() {
  return [
    ['category' => 'HARM_CATEGORY_HARASSMENT',        'threshold' => 'BLOCK_ONLY_HIGH'],
    ['category' => 'HARM_CATEGORY_HATE_SPEECH',       'threshold' => 'BLOCK_ONLY_HIGH'],
    ['category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_ONLY_HIGH'],
    ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_ONLY_HIGH'],
  ];
}

// Extrae el primer objeto JSON de un texto (por si el modelo añade ``` u otro texto).
function af_extract_json($s) {
  $s = trim((string) $s);
  $s = preg_replace('/^```(?:json)?/i', '', $s);
  $s = preg_replace('/```$/', '', trim($s));
  $a = strpos($s, '{'); $b = strrpos($s, '}');
  if ($a === false || $b === false || $b < $a) return null;
  $d = json_decode(substr($s, $a, $b - $a + 1), true);
  return is_array($d) ? $d : null;
}

function af_str($v, $max = 120) {
  if (!is_scalar($v)) return null;
  $v = trim(preg_replace('/\s+/u', ' ', (string) $v));
  return $v === '' ? null : mb_substr($v, 0, $max);
}
function af_date($v) {
  if (!is_string($v)) return null;
  $v = trim($v);
  if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $v, $m)) return null;
  if (!checkdate((int) $m[2], (int) $m[3], (int) $m[1])) return null;
  if ((int) $m[1] < 1990 || (int) $m[1] > (int) date('Y') + 5) return null;
  return $v;
}
function af_num($v) {
  if ($v === null || $v === '') return null;
  if (is_int($v) || is_float($v)) return (float) $v;
  $s = str_replace([',', ' ', 'kg'], ['.', '', ''], (string) $v);
  return is_numeric($s) ? (float) $s : null;
}
