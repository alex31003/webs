<?php
// setup.php — activar la IA de Amigo Fiel UNA sola vez desde el navegador:
//   1) la clave gratuita de Google Gemini (se valida y se guarda en el servidor, fuera de public_html si es posible)
//   2) la contraseña del panel de contactos (panel.php)
// Nada se muestra ni se registra. Una vez configurado, no se puede cambiar desde aquí.
// Recomendado: borrar este archivo del servidor cuando esté todo configurado.

$G_OUT = dirname(__DIR__) . '/gemini_api_key.php';   $G_IN = __DIR__ . '/secret_config.php';
$P_OUT = dirname(__DIR__) . '/amigofiel_panel.php';  $P_IN = __DIR__ . '/datos/panel_pass.php';

function read_val($out, $in) {
  foreach ([$out, $in] as $f) { if (is_file($f)) { $v = @include $f; if (is_string($v) && trim($v) !== '') return trim($v); } }
  return '';
}
function write_val($out, $in, $val) {
  $content = "<?php return '" . str_replace(["\\", "'"], ["\\\\", "\\'"], $val) . "';\n";
  if (is_writable(dirname($out)) && @file_put_contents($out, $content, LOCK_EX) !== false) return true;
  return (@file_put_contents($in, $content, LOCK_EX) !== false);
}
function validate_gemini($key) {
  if (!function_exists('curl_init')) return false;
  $ch = curl_init('https://generativelanguage.googleapis.com/v1beta/models');
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => ['x-goog-api-key: ' . $key]]);
  $r = curl_exec($ch); $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
  return ($r !== false && $c === 200);
}

$gSet = read_val($G_OUT, $G_IN) !== '' || getenv('GEMINI_API_KEY');
$pSet = read_val($P_OUT, $P_IN) !== '';
$msg = ''; $tone = 'info';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  if (isset($_POST['gemini_key']) && !$gSet) {
    $k = trim((string) $_POST['gemini_key']);
    if ($k === '' || strpos($k, 'AIza') !== 0 || strlen($k) > 80) { $msg = 'La clave debe empezar por «AIza». Revísala y vuelve a pegarla.'; $tone = 'warn'; }
    elseif (!validate_gemini($k)) { $msg = 'Google no ha aceptado esa clave. Comprueba que la has copiado entera.'; $tone = 'warn'; }
    elseif (write_val($G_OUT, $G_IN, $k)) { $gSet = true; $msg = '¡Listo! La IA ya está activada: el asistente y el planificador funcionan.'; $tone = 'ok'; }
    else { $msg = 'La clave es correcta pero no se ha podido guardar en el servidor (permisos).'; $tone = 'warn'; }
  } elseif (isset($_POST['panel_pass']) && !$pSet) {
    $p = (string) $_POST['panel_pass'];
    if (mb_strlen($p) < 8) { $msg = 'La contraseña del panel debe tener al menos 8 caracteres.'; $tone = 'warn'; }
    elseif (write_val($P_OUT, $P_IN, password_hash($p, PASSWORD_DEFAULT))) { $pSet = true; $msg = 'Contraseña del panel guardada. Entra en panel.php para ver los contactos.'; $tone = 'ok'; }
    else { $msg = 'No se ha podido guardar la contraseña (permisos).'; $tone = 'warn'; }
  } else {
    $msg = 'Eso ya estaba configurado. Por seguridad no se puede cambiar desde aquí.';
  }
}
header('X-Robots-Tag: noindex, nofollow');
?><!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Activar IA · Amigo Fiel</title>
<style>
  :root{--ink:#111;--ink2:#1F1D1B;--cream:#FFF9EC;--mut:rgba(255,249,236,.65);--red:#D62828;--yel:#FFC300;--brd:rgba(255,249,236,.14)}
  *{box-sizing:border-box;margin:0}
  body{font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;background:radial-gradient(50% 40% at 85% 0%,rgba(214,40,40,.25),transparent 70%),var(--ink);color:var(--cream);min-height:100vh;display:grid;place-items:center;padding:24px;line-height:1.6}
  .box{width:100%;max-width:500px;background:var(--ink2);border:1px solid var(--brd);border-radius:24px;padding:30px;box-shadow:0 30px 60px -25px rgba(0,0,0,.8)}
  h1{font-size:1.5rem;letter-spacing:-.02em;margin-bottom:6px}
  h1 em{font-style:italic;color:var(--yel);font-weight:400;font-family:Georgia,serif}
  .sub{color:var(--mut);font-size:.94rem;margin-bottom:20px}
  .card{border:1px solid var(--brd);border-radius:16px;padding:18px;margin-bottom:14px}
  .card h2{font-size:1rem;margin-bottom:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .pill{font-size:.72rem;padding:3px 9px;border-radius:999px;border:1px solid var(--brd)}
  .pill.ok{background:var(--yel);color:var(--ink);border-color:var(--yel);font-weight:700}
  .pill.no{color:var(--mut)}
  .hint{color:var(--mut);font-size:.86rem;margin:6px 0 12px}
  .hint a{color:var(--yel)}
  input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--brd);background:#111;color:var(--cream);font:inherit}
  input:focus{outline:none;border-color:var(--yel);box-shadow:0 0 0 3px rgba(255,195,0,.2)}
  button{width:100%;margin-top:10px;padding:13px;border:0;border-radius:999px;cursor:pointer;font-weight:700;font:inherit;font-weight:700;color:#fff;background:var(--red)}
  button:hover{background:#B51F1F}
  .msg{margin-top:14px;padding:12px 14px;border-radius:12px;font-size:.92rem;border:1px solid var(--brd)}
  .ok{background:rgba(255,195,0,.12);border-color:rgba(255,195,0,.45)}
  .warn{background:rgba(214,40,40,.14);border-color:rgba(214,40,40,.5)}
  .foot{margin-top:16px;font-size:.78rem;color:var(--mut)}
  code{background:rgba(255,249,236,.08);padding:2px 6px;border-radius:6px}
</style>
</head>
<body>
  <main class="box">
    <h1>Activar la IA de Amigo <em>Fiel</em></h1>
    <p class="sub">Pega aquí la clave gratuita de Google una sola vez. Se guarda en el servidor y nunca se muestra a los visitantes.</p>

    <div class="card">
      <h2>Clave de Google Gemini <span class="pill <?php echo $gSet ? 'ok' : 'no'; ?>"><?php echo $gSet ? 'Activada ✓' : 'Pendiente'; ?></span></h2>
      <?php if (!$gSet): ?>
        <p class="hint">Créala gratis en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> → «Crear clave de API». Empieza por <code>AIza…</code></p>
        <form method="post" autocomplete="off">
          <input name="gemini_key" type="password" placeholder="AIza..." required>
          <button type="submit">Activar la IA</button>
        </form>
      <?php endif; ?>
    </div>

    <div class="card">
      <h2>Contraseña del panel de contactos <span class="pill <?php echo $pSet ? 'ok' : 'no'; ?>"><?php echo $pSet ? 'Guardada ✓' : 'Pendiente'; ?></span></h2>
      <?php if (!$pSet): ?>
        <p class="hint">Con ella la clínica verá en <code>panel.php</code> los emails y citas que llegan desde la web.</p>
        <form method="post" autocomplete="off">
          <input name="panel_pass" type="password" placeholder="Mínimo 8 caracteres" minlength="8" required>
          <button type="submit">Guardar contraseña</button>
        </form>
      <?php endif; ?>
    </div>

    <?php if ($gSet && $pSet): ?><div class="msg ok">✅ Todo configurado. Por seguridad, borra <code>setup.php</code> del servidor.</div><?php endif; ?>
    <?php if ($msg): ?><div class="msg <?php echo $tone; ?>"><?php echo htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'); ?></div><?php endif; ?>
    <p class="foot">Amigo Fiel · La clave no se comparte con el navegador ni se registra en ningún sitio.</p>
  </main>
</body>
</html>
