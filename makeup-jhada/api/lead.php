<?php
// lead.php — guarda nombre + WhatsApp de la clienta (y su plan) para que
// Dayana confirme la cita. Se guarda FUERA de public_html si se puede; si no,
// en datos/ (bloqueado al público por .htaccess). Solo la dueña lo puede leer
// desde leads.php con su contraseña.

require __DIR__ . '/_base.php';
guard_request();

if (rate_limit('lead', 4, 20, 2000) !== null) out(['ok' => false, 'reason' => 'rate']);

$in = read_json_body();
$s = fn($v, $max = 120) => trim(mb_substr(is_scalar($v) ? (string) $v : '', 0, $max));

$nombre = $s($in['nombre'] ?? '', 80);
$tel = preg_replace('/[^0-9+]/', '', $s($in['whatsapp'] ?? '', 24));
if (mb_strlen($nombre) < 2) out(['ok' => false, 'reason' => 'nombre']);
if (strlen(preg_replace('/\D/', '', $tel)) < 9) out(['ok' => false, 'reason' => 'whatsapp']);
if (empty($in['consent'])) out(['ok' => false, 'reason' => 'consent']);

$p = is_array($in['plan'] ?? null) ? $in['plan'] : [];
$row = [
  'fecha_registro' => date('c'),
  'nombre'      => $nombre,
  'whatsapp'    => $tel,
  'evento'      => $s($p['evento'] ?? '', 40),
  'fecha_evento'=> $s($p['fecha'] ?? '', 12),
  'tono'        => $s($p['tono'] ?? '', 20),
  'estilo'      => $s($p['estilo'] ?? '', 20),
  'presupuesto' => (int) ($p['presupuesto'] ?? 0),
  'peinado'     => !empty($p['peinado']) ? 'sí' : 'no',
  'lugar'       => $s($p['lugar'] ?? '', 12),
  'paquete'     => $s($p['paquete'] ?? '', 60),
  'precio'      => (int) ($p['precio'] ?? 0),
  'look'        => $s($p['look'] ?? '', 80),
  'interes_clases' => !empty($p['clases']) ? 'sí' : 'no',
];

$dirs = [dirname(__DIR__, 2), dirname(__DIR__) . '/datos'];
$stored = false;
foreach ($dirs as $dir) {
  if (!is_dir($dir) || !is_writable($dir)) continue;
  $ok1 = @file_put_contents($dir . '/jhada_leads.jsonl', json_encode($row, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX) !== false;
  $csv = $dir . '/jhada_leads.csv';
  $nuevo = !is_file($csv);
  if ($fh = @fopen($csv, 'a')) {
    if (flock($fh, LOCK_EX)) {
      if ($nuevo) { fwrite($fh, "\xEF\xBB\xBF"); fputcsv($fh, array_keys($row)); }
      fputcsv($fh, array_values($row));
      flock($fh, LOCK_UN);
    }
    fclose($fh);
  }
  if ($ok1) { $stored = true; break; }
}
if (!$stored) @error_log('[jhada-lead] no se pudo guardar el lead');
out(['ok' => true, 'stored' => $stored]);
