<?php
// leads.php — panel privado de Dayana: contactos que dejó el Planificador de Look.
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
session_start();

$paths = [dirname(__DIR__) . '/jhada_secret.php', __DIR__ . '/datos/secret.php'];
$sec = [];
foreach ($paths as $p) { if (is_file($p)) { $v = @include $p; if (is_array($v)) { $sec = $v; break; } } }

$err = '';
if (isset($_POST['pass'])) {
  if (!empty($sec['admin_hash']) && password_verify((string) $_POST['pass'], $sec['admin_hash'])) {
    session_regenerate_id(true);
    $_SESSION['jhada_admin'] = true;
  } else { sleep(1); $err = 'Contraseña incorrecta.'; }
}
if (isset($_GET['salir'])) { $_SESSION = []; session_destroy(); header('Location: leads.php'); exit; }
$auth = !empty($_SESSION['jhada_admin']);

$rows = [];
$csvPath = null;
if ($auth) {
  foreach ([dirname(__DIR__), __DIR__ . '/datos'] as $dir) {
    $f = $dir . '/jhada_leads.jsonl';
    if (is_file($f)) {
      foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) { $r = json_decode($line, true); if (is_array($r)) $rows[] = $r; }
      if (is_file($dir . '/jhada_leads.csv')) $csvPath = $dir . '/jhada_leads.csv';
    }
  }
  $rows = array_reverse($rows);
  if (isset($_GET['csv']) && $csvPath) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="contactos-makeup-jhada.csv"');
    readfile($csvPath); exit;
  }
}
$h = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Contactos · Makeup Jhada</title><meta name="robots" content="noindex">
<style>
:root{--choc:#3D1C1C;--gold:#C9A84C;--wine:#6B2D3E;--nude:#F5E6DA;--ink:#0D0D0D}
*{box-sizing:border-box}body{margin:0;background:var(--choc);color:var(--nude);font:15px/1.5 system-ui,sans-serif;padding:16px}
h1{font:600 1.6rem Georgia,serif;color:var(--gold)}a{color:var(--gold)}
.card{max-width:420px;margin:12vh auto;background:#2a1212;border:1px solid rgba(201,168,76,.35);border-radius:20px;padding:28px}
input{width:100%;padding:.8rem 1rem;border-radius:12px;border:1px solid rgba(245,230,218,.25);background:#1d0c0c;color:var(--nude);font:inherit}
button,.btn{display:inline-block;margin-top:1rem;padding:.7rem 1.3rem;border-radius:999px;border:0;background:var(--gold);color:var(--ink);font-weight:700;text-decoration:none;cursor:pointer}
.list{display:grid;gap:12px;max-width:1100px;margin:0 auto}
.lead{background:#2a1212;border:1px solid rgba(201,168,76,.25);border-radius:16px;padding:16px;display:grid;gap:4px}
.lead b{color:var(--gold)}.top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;max-width:1100px;margin:0 auto 16px}
.err{background:var(--wine);padding:.6rem 1rem;border-radius:12px;margin-bottom:.8rem}
</style></head><body>
<?php if (!$auth): ?>
<main class="card"><h1>Contactos</h1>
<?php if (empty($sec['admin_hash'])): ?><p>Primero configura la IA y tu contraseña en <a href="setup.php">setup.php</a>.</p>
<?php else: ?>
<?php if ($err): ?><div class="err"><?= $h($err) ?></div><?php endif; ?>
<form method="post"><input type="password" name="pass" placeholder="Contraseña" required autofocus><button>Entrar</button></form>
<?php endif; ?></main>
<?php else: ?>
<div class="top"><h1>Contactos del planificador (<?= count($rows) ?>)</h1>
<div><?php if ($csvPath): ?><a class="btn" href="?csv=1">Descargar Excel (CSV)</a> <?php endif; ?><a href="?salir=1">Salir</a></div></div>
<div class="list">
<?php if (!$rows): ?><p>Todavía no hay contactos.</p><?php endif; ?>
<?php foreach ($rows as $r): $wa = preg_replace('/\D/', '', $r['whatsapp'] ?? ''); if (str_starts_with($wa, '0')) $wa = '593' . substr($wa, 1); ?>
<article class="lead">
<div><b><?= $h($r['nombre'] ?? '') ?></b> · <a href="https://wa.me/<?= $h($wa) ?>" target="_blank" rel="noopener"><?= $h($r['whatsapp'] ?? '') ?></a></div>
<div><?= $h($r['paquete'] ?? '') ?> ($<?= $h($r['precio'] ?? '') ?>) · Evento: <?= $h($r['evento'] ?? '') ?> · Fecha: <?= $h($r['fecha_evento'] ?: '—') ?> · <?= $h($r['lugar'] ?? '') ?></div>
<div>Look: <?= $h($r['look'] ?: '—') ?> · Tono <?= $h($r['tono'] ?? '') ?> · Estilo <?= $h($r['estilo'] ?? '') ?> · Presupuesto ~$<?= $h($r['presupuesto'] ?? '') ?> · Clases: <?= $h($r['interes_clases'] ?? '') ?></div>
<small>Registrado: <?= $h($r['fecha_registro'] ?? '') ?></small>
</article>
<?php endforeach; ?>
</div>
<?php endif; ?>
</body></html>
