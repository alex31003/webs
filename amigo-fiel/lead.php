<?php
// lead.php — guarda los contactos de la web (plan de cuidados y solicitudes de cita).
// Se guardan FUERA de public_html si es posible (../amigofiel_contactos.*) y, si no,
// en datos/ (protegido por .htaccess). Solo la clínica puede verlos (panel.php).
// Aviso por email opcional: crea ../amigofiel_aviso.php con <?php return 'clinica@dominio.com';
require __DIR__ . '/ia-comun.php';
af_json_headers();
af_guard_post();

if ($r = af_rate('lead', 6, 60, 0)) af_out(['ok' => false, 'reason' => $r]);

$in = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($in)) af_out(['ok' => false, 'reason' => 'input'], 400);

$email = trim((string) ($in['email'] ?? ''));
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 160) af_out(['ok' => false, 'reason' => 'email']);
if (empty($in['consent'])) af_out(['ok' => false, 'reason' => 'consent']);
$tipo = ($in['tipo'] ?? '') === 'cita' ? 'cita' : 'plan';
$tel = mb_substr(preg_replace('/[^0-9+\s]/', '', (string) ($in['telefono'] ?? '')), 0, 24);

$m = is_array($in['mascota'] ?? null) ? $in['mascota'] : [];
$res = is_array($in['resumen'] ?? null) ? $in['resumen'] : [];
$cita = is_array($in['cita'] ?? null) ? $in['cita'] : [];
$prox = [];
foreach (array_slice(is_array($res['proximas'] ?? null) ? $res['proximas'] : [], 0, 4) as $p) {
  if (is_array($p)) $prox[] = trim((af_date($p['fecha'] ?? null) ?: '') . ' ' . (af_str($p['que'] ?? null, 90) ?: ''));
}

$row = [
  'fecha'          => date('Y-m-d H:i'),
  'tipo'           => $tipo,
  'tutor'          => af_str($in['tutor'] ?? null, 60),
  'email'          => $email,
  'telefono'       => $tel,
  'mascota'        => af_str($m['nombre'] ?? null, 40),
  'especie'        => af_str($m['especie'] ?? null, 10),
  'raza'           => af_str($m['raza'] ?? null, 60),
  'edad_meses'     => af_num($m['edad_meses'] ?? null),
  'peso_kg'        => af_num($m['peso_kg'] ?? null),
  'estilo_vida'    => implode(', ', array_filter(array_map(function ($x) { return af_str($x, 20); }, array_slice(is_array($m['estilo_vida'] ?? null) ? $m['estilo_vida'] : [], 0, 8)))),
  'salud'          => af_str($m['salud'] ?? null, 20),
  'notas'          => af_str($m['notas'] ?? null, 400),
  'etapa'          => af_str($res['etapa'] ?? null, 12),
  'plan_sugerido'  => af_str($res['plan'] ?? null, 40),
  'coste_sueltas'  => af_num($res['coste_sueltas'] ?? null),
  'coste_plan'     => af_num($res['coste_plan'] ?? null),
  'cartilla_leida' => !empty($res['cartilla_leida']) ? 'sí' : '',
  'proximas'       => implode(' | ', $prox),
  'motivo_cita'    => af_str($cita['motivo'] ?? null, 60),
  'preferencia'    => af_str($cita['preferencia'] ?? null, 30),
  'comentarios'    => af_str($cita['comentarios'] ?? null, 400),
];

// Destino: fuera de public_html si se puede; si no, datos/ protegido.
$dir = null;
foreach ([dirname(__DIR__), __DIR__ . '/datos'] as $c) {
  if (is_dir($c) && is_writable($c)) { $dir = $c; break; }
}
$stored = false;
if ($dir !== null) {
  $base = $dir . '/' . AF_PREFIX . '_contactos';
  if (@file_put_contents($base . '.jsonl', json_encode($row, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX) !== false) $stored = true;
  $isNew = !is_file($base . '.csv');
  if ($fh = @fopen($base . '.csv', 'a')) {
    if (flock($fh, LOCK_EX)) {
      if ($isNew) { fwrite($fh, "\xEF\xBB\xBF"); fputcsv($fh, array_keys($row), ';'); }
      // Evita fórmulas al abrir en Excel
      $vals = array_map(function ($v) { $v = (string) $v; return preg_match('/^[=+\-@]/', $v) ? "'" . $v : $v; }, array_values($row));
      fputcsv($fh, $vals, ';');
      flock($fh, LOCK_UN);
    }
    fclose($fh);
  }
}

// Aviso por email a la clínica (opcional)
$to = '';
if (is_file(dirname(__DIR__) . '/amigofiel_aviso.php')) { $v = @include dirname(__DIR__) . '/amigofiel_aviso.php'; if (is_string($v)) $to = trim($v); }
if ($stored && $to !== '' && filter_var($to, FILTER_VALIDATE_EMAIL) && function_exists('mail')) {
  $asunto = ($tipo === 'cita' ? 'Nueva solicitud de cita' : 'Nuevo plan de cuidados') . ' — ' . ($row['mascota'] ?: $email);
  $cuerpo = '';
  foreach ($row as $k => $v) { if ($v !== null && $v !== '') $cuerpo .= str_pad($k, 16) . ': ' . $v . "\n"; }
  $host = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'amigofiel.example');
  @mail($to, '=?UTF-8?B?' . base64_encode($asunto) . '?=', $cuerpo, "From: web@$host\r\nContent-Type: text/plain; charset=utf-8");
}

if (!$stored) @error_log('[amigofiel-lead] no se pudo guardar el contacto');
af_out(['ok' => $stored]);
