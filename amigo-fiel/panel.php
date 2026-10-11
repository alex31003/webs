<?php
// panel.php — la clínica ve aquí los contactos que llegan desde la web (planes de cuidados y citas).
// Protegido con la contraseña definida en setup.php.
session_start();
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

$hash = '';
foreach ([dirname(__DIR__) . '/amigofiel_panel.php', __DIR__ . '/datos/panel_pass.php'] as $f) {
  if (is_file($f)) { $v = @include $f; if (is_string($v) && $v !== '') { $hash = $v; break; } }
}
$base = null;
foreach ([dirname(__DIR__), __DIR__ . '/datos'] as $d) {
  if (is_file($d . '/amigofiel_contactos.jsonl')) { $base = $d . '/amigofiel_contactos'; break; }
}

$err = '';
if (isset($_POST['pass']) && $hash !== '') {
  $tries = $_SESSION['tries'] ?? 0;
  if ($tries >= 8) { $err = 'Demasiados intentos. Espera unos minutos.'; }
  elseif (password_verify((string) $_POST['pass'], $hash)) { session_regenerate_id(true); $_SESSION['ok'] = true; $_SESSION['tries'] = 0; }
  else { $_SESSION['tries'] = $tries + 1; sleep(1); $err = 'Contraseña incorrecta.'; }
}
if (isset($_GET['salir'])) { $_SESSION = []; session_destroy(); header('Location: panel.php'); exit; }
$ok = !empty($_SESSION['ok']) && $hash !== '';

if ($ok && isset($_GET['csv']) && $base && is_file($base . '.csv')) {
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="amigofiel-contactos-' . date('Ymd') . '.csv"');
  readfile($base . '.csv');
  exit;
}

$rows = [];
if ($ok && $base) {
  foreach (array_reverse(file($base . '.jsonl', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []) as $l) {
    $r = json_decode($l, true);
    if (is_array($r)) $rows[] = $r;
  }
}
$h = function ($v) { return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8'); };
?><!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Contactos · Amigo Fiel</title>
<style>
  :root{--ink:#111;--ink2:#1F1D1B;--cream:#FFF9EC;--mut:rgba(255,249,236,.6);--red:#D62828;--yel:#FFC300;--brd:rgba(255,249,236,.12)}
  *{box-sizing:border-box;margin:0}
  body{font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--ink);color:var(--cream);line-height:1.5;padding:24px}
  .wrap{max-width:1100px;margin:0 auto}
  header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:24px}
  h1{font-size:1.6rem;letter-spacing:-.02em} h1 em{font-family:Georgia,serif;font-weight:400;color:var(--yel)}
  a.btn,button{display:inline-block;padding:10px 16px;border-radius:999px;background:var(--red);color:#fff;text-decoration:none;font-weight:600;border:0;font:inherit;font-weight:600;cursor:pointer}
  a.ghost{background:transparent;border:1px solid var(--brd);color:var(--cream)}
  .login{max-width:380px;margin:12vh auto;background:var(--ink2);padding:28px;border-radius:20px;border:1px solid var(--brd)}
  input{width:100%;padding:12px;border-radius:12px;border:1px solid var(--brd);background:#111;color:var(--cream);font:inherit;margin:12px 0}
  .card{background:var(--ink2);border:1px solid var(--brd);border-radius:16px;padding:16px 18px;margin-bottom:12px}
  .top{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}
  .tag{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:6px;background:var(--yel);color:var(--ink)}
  .tag.cita{background:var(--red);color:#fff}
  .mut{color:var(--mut);font-size:.88rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:4px 16px;margin-top:10px;font-size:.9rem}
  .grid b{color:var(--mut);font-weight:500}
  .err{color:#ffb3b3;margin-top:8px}
  .empty{color:var(--mut);padding:40px;text-align:center;border:1px dashed var(--brd);border-radius:16px}
</style>
</head>
<body><div class="wrap">
<?php if ($hash === ''): ?>
  <div class="login"><h1>Panel sin configurar</h1><p class="mut" style="margin-top:8px">Define primero la contraseña del panel en <code>setup.php</code>.</p></div>
<?php elseif (!$ok): ?>
  <form class="login" method="post"><h1>Amigo <em>Fiel</em> · Contactos</h1><input type="password" name="pass" placeholder="Contraseña del panel" required autofocus><button type="submit">Entrar</button><?php if ($err): ?><p class="err"><?php echo $h($err); ?></p><?php endif; ?></form>
<?php else: ?>
  <header><h1>Contactos de la web · Amigo <em>Fiel</em></h1><div><?php if ($rows): ?><a class="btn" href="?csv=1">Descargar Excel (CSV)</a> <?php endif; ?><a class="btn ghost" href="?salir=1">Salir</a></div></header>
  <p class="mut" style="margin-bottom:16px"><?php echo count($rows); ?> contacto(s), los más recientes primero.</p>
  <?php if (!$rows): ?><div class="empty">Todavía no hay contactos. Aparecerán aquí cuando alguien pida cita o genere su plan de cuidados.</div><?php endif; ?>
  <?php foreach ($rows as $r): ?>
    <div class="card">
      <div class="top"><span class="tag <?php echo $r['tipo'] === 'cita' ? 'cita' : ''; ?>"><?php echo $r['tipo'] === 'cita' ? 'Cita' : 'Plan de cuidados'; ?></span>
        <strong><?php echo $h($r['tutor'] ?: '(sin nombre)'); ?></strong>
        <a style="color:var(--yel)" href="mailto:<?php echo $h($r['email']); ?>"><?php echo $h($r['email']); ?></a>
        <?php if (!empty($r['telefono'])): ?><a style="color:var(--yel)" href="tel:<?php echo $h(preg_replace('/\s/', '', $r['telefono'])); ?>"><?php echo $h($r['telefono']); ?></a><?php endif; ?>
        <span class="mut"><?php echo $h($r['fecha']); ?></span></div>
      <div class="grid">
        <?php foreach (['mascota' => 'Mascota', 'especie' => 'Especie', 'raza' => 'Raza', 'edad_meses' => 'Edad (meses)', 'peso_kg' => 'Peso (kg)', 'estilo_vida' => 'Estilo de vida', 'salud' => 'Salud', 'etapa' => 'Etapa', 'plan_sugerido' => 'Plan sugerido', 'coste_sueltas' => 'Coste visitas sueltas (€)', 'coste_plan' => 'Coste con plan (€)', 'cartilla_leida' => 'Cartilla leída', 'motivo_cita' => 'Motivo', 'preferencia' => 'Preferencia', 'notas' => 'Notas', 'comentarios' => 'Comentarios', 'proximas' => 'Próximas citas'] as $k => $label): if (!isset($r[$k]) || $r[$k] === '' || $r[$k] === null) continue; ?>
          <div><b><?php echo $label; ?>:</b> <?php echo $h($r[$k]); ?></div>
        <?php endforeach; ?>
      </div>
    </div>
  <?php endforeach; ?>
<?php endif; ?>
</div></body>
</html>
