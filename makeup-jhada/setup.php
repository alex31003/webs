<?php
// setup.php — pega aquí UNA vez la clave de la IA (Anthropic / Claude) y crea la
// contraseña para ver los contactos (leads.php). La clave se guarda en el
// servidor, fuera de la carpeta pública si es posible, y nunca se muestra.
// Cuando todo funcione puedes borrar este archivo (o dejarlo: pide contraseña).

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$paths = [dirname(__DIR__) . '/jhada_secret.php', __DIR__ . '/datos/secret.php'];
$current = [];
foreach ($paths as $p) { if (is_file($p)) { $v = @include $p; if (is_array($v)) { $current = $v; break; } } }
$configured = !empty($current['anthropic_key']);

$msg = ''; $okMsg = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  $key  = trim((string) ($_POST['key'] ?? ''));
  $pass = (string) ($_POST['pass'] ?? '');
  $old  = (string) ($_POST['old'] ?? '');
  if ($configured && !password_verify($old, (string) ($current['admin_hash'] ?? ''))) {
    $msg = 'La contraseña actual no es correcta.';
  } elseif (!preg_match('/^sk-ant-[A-Za-z0-9_\-]{20,}$/', $key)) {
    $msg = 'Esa clave no parece válida: debe empezar por «sk-ant-».';
  } elseif (mb_strlen($pass) < 8) {
    $msg = 'La contraseña debe tener al menos 8 caracteres.';
  } else {
    // Comprobar la clave en vivo
    $valid = false;
    try {
      require_once __DIR__ . '/api/vendor/autoload.php';
      $c = new \Anthropic\Client(apiKey: $key);
      $c->models->retrieve('claude-opus-5-5');
      $valid = true;
    } catch (\Anthropic\Core\Exceptions\AuthenticationException $e) {
      $msg = 'La clave fue rechazada. Revisa que la copiaste completa.';
    } catch (\Throwable $e) {
      $msg = 'No pude comprobar la clave ahora mismo. Inténtalo de nuevo en un minuto.';
    }
    if ($valid) {
      $data = "<?php\nreturn " . var_export(['anthropic_key' => $key, 'admin_hash' => password_hash($pass, PASSWORD_DEFAULT)], true) . ";\n";
      $saved = false;
      foreach ($paths as $p) {
        $dir = dirname($p);
        if (is_dir($dir) && is_writable($dir) && @file_put_contents($p, $data, LOCK_EX) !== false) { @chmod($p, 0600); $saved = true; break; }
      }
      $okMsg = $saved ? '¡Listo! La IA quedó configurada ✨ El asistente y el planificador ya funcionan.' : '';
      if (!$saved) $msg = 'La clave es válida, pero no tengo permiso para guardarla en el servidor.';
      $configured = $configured || $saved;
    }
  }
}
?><!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Configurar IA · Makeup Jhada</title><meta name="robots" content="noindex">
<style>
:root{--choc:#3D1C1C;--gold:#C9A84C;--nude:#F5E6DA;--ink:#0D0D0D}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--choc);color:var(--nude);font:16px/1.6 system-ui,sans-serif;padding:16px}
.card{width:100%;max-width:440px;background:#2a1212;border:1px solid rgba(201,168,76,.35);border-radius:20px;padding:28px}
h1{font:600 1.5rem Georgia,serif;color:var(--gold);margin:0 0 .4rem}p{margin:.2rem 0 1rem;opacity:.85}
label{display:block;font-size:.85rem;margin:.9rem 0 .3rem;color:var(--gold)}
input{width:100%;padding:.8rem 1rem;border-radius:12px;border:1px solid rgba(245,230,218,.25);background:#1d0c0c;color:var(--nude);font:inherit}
button{margin-top:1.2rem;width:100%;padding:.9rem;border-radius:999px;border:0;background:var(--gold);color:var(--ink);font-weight:700;cursor:pointer}
.err{background:#6B2D3E;padding:.7rem 1rem;border-radius:12px}.ok{background:rgba(201,168,76,.18);border:1px solid var(--gold);padding:.7rem 1rem;border-radius:12px}
small{opacity:.7}
</style></head><body><main class="card">
<h1>Configurar la IA</h1>
<p>Pega la clave de Claude (empieza por <b>sk-ant-</b>) y crea una contraseña para ver los contactos que deja el planificador.</p>
<?php if ($msg): ?><div class="err"><?= htmlspecialchars($msg) ?></div><?php endif; ?>
<?php if ($okMsg): ?><div class="ok"><?= htmlspecialchars($okMsg) ?> <a href="leads.php" style="color:var(--gold)">Ver contactos</a></div><?php endif; ?>
<form method="post" autocomplete="off">
<?php if ($configured): ?><label>Contraseña actual (para cambiar la clave)</label><input type="password" name="old" required><?php endif; ?>
<label>Clave de la IA</label><input type="password" name="key" placeholder="sk-ant-..." required>
<label>Contraseña para ver contactos</label><input type="password" name="pass" minlength="8" required>
<button type="submit">Guardar</button>
</form>
<p><small>La clave se guarda en el servidor y nunca se muestra en la web.</small></p>
</main></body></html>
