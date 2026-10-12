<?php
// _base.php — utilidades compartidas por chat.php, plan.php y lead.php.
// La clave de la IA vive SOLO en el servidor y nunca se envía al navegador.

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$CFG = require __DIR__ . '/config.php';

function out(array $arr, int $code = 200): void {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

// --- Solo POST + mismo origen (evita que otras webs usen el saldo de la IA) ---
function guard_request(): void {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(['ok' => false, 'error' => 'method'], 405);
  $host = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
  $src  = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
  if ($src !== '') {
    $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
    if ($srcHost === '' || $srcHost !== $host) out(['ok' => false, 'error' => 'origin'], 403);
  }
}

function read_json_body(): array {
  $raw = file_get_contents('php://input', false, null, 0, 64000);
  $in = json_decode((string) $raw, true);
  return is_array($in) ? $in : [];
}

function client_ip(): string {
  return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

// --- Límite de uso por IP + tope global diario. Devuelve null si OK o un motivo. ---
function rate_limit(string $bucket, int $perMin, int $perDay, int $globalDay): ?string {
  $tmp = sys_get_temp_dir();
  $now = time();
  $f = $tmp . '/jhada_' . $bucket . '_' . md5(client_ip()) . '.json';
  $stamps = is_file($f) ? json_decode((string) @file_get_contents($f), true) : [];
  if (!is_array($stamps)) $stamps = [];
  $min = count(array_filter($stamps, fn($t) => $t > $now - 60));
  $day = count(array_filter($stamps, fn($t) => $t > $now - 86400));
  if ($min >= $perMin) return 'min';
  if ($day >= $perDay) return 'day';
  $g = $tmp . '/jhada_global_' . date('Ymd') . '.txt';
  $gc = is_file($g) ? (int) @file_get_contents($g) : 0;
  if ($gc >= $globalDay) return 'global';
  $stamps[] = $now;
  @file_put_contents($f, json_encode(array_slice($stamps, -300)), LOCK_EX);
  @file_put_contents($g, (string) ($gc + 1), LOCK_EX);
  return null;
}

// --- Secretos: variable de entorno -> archivo fuera de public_html -> datos/secret.php ---
function secret_paths(): array {
  return [dirname(__DIR__, 2) . '/jhada_secret.php', dirname(__DIR__) . '/datos/secret.php'];
}
function load_secrets(): array {
  foreach (secret_paths() as $p) {
    if (is_file($p)) {
      $v = @include $p;
      if (is_array($v)) return $v;
    }
  }
  return [];
}
function anthropic_key(): string {
  $k = getenv('ANTHROPIC_API_KEY');
  if (!$k) $k = load_secrets()['anthropic_key'] ?? '';
  return is_string($k) ? trim($k) : '';
}

function make_client(): ?\Anthropic\Client {
  $key = anthropic_key();
  if ($key === '') return null;
  require_once __DIR__ . '/vendor/autoload.php';
  return new \Anthropic\Client(apiKey: $key);
}

// Texto de la primera respuesta de texto del modelo
function first_text($message): string {
  foreach ($message->content as $block) {
    if ($block->type === 'text') return (string) $block->text;
  }
  return '';
}

function log_err(string $where, \Throwable $e): void {
  @error_log('[jhada-' . $where . '] ' . get_class($e) . ': ' . substr($e->getMessage(), 0, 400));
}

// --- Bloque de conocimiento compartido (precios reales) para los prompts ---
function knowledge_text(array $CFG): string {
  $n = $CFG['negocio'];
  $t = "NEGOCIO: {$n['nombre']}, estudio de maquillaje profesional en {$n['ciudad']}, dirigido por la maquilladora {$n['artista']}, con experiencia desde {$n['desde']}.\n";
  $t .= "AGENDAR: WhatsApp {$n['whatsapp']} (wa.me/{$n['whatsapp_intl']}) o Instagram {$n['instagram']}.\n";
  $t .= "UBICACIÓN: {$n['direccion']['texto']}" . ($n['direccion']['ejemplo'] ? " (dato provisional: confirma la dirección exacta por WhatsApp)" : '') . ".\n";
  $t .= "HORARIO: {$n['horario']['texto']}" . ($n['horario']['ejemplo'] ? " (dato provisional: confirma por WhatsApp)" : '') . ".\n\n";
  $t .= "SERVICIOS Y PRECIOS REALES (en dólares, USD):\n";
  foreach ($CFG['servicios'] as $s) {
    $t .= "- {$s['nombre']} — \${$s['precio']}. Incluye: " . implode(' · ', $s['incluye']) . ". {$s['domicilio']}. Duración estimada: {$s['duracion']} (orientativa).\n";
  }
  $c = $CFG['clases'];
  $t .= "- {$c['nombre']}: {$c['num_clases']} clases a \${$c['precio_clase']} por clase + matrícula de \${$c['matricula']} (inversión total \${$c['total']}). Incluye GRATIS: " . implode(' · ', $c['incluye_gratis']) . ".\n";
  $t .= "\nEl costo adicional a domicilio NO tiene un precio fijo publicado: depende del sector y se confirma por WhatsApp. Nunca inventes una cifra para el domicilio.\n";
  return $t;
}
