<?php
// lector-documento.php — lee con IA (Gemini multimodal) una foto de la cartilla de
// vacunación o un PDF de un informe veterinario y devuelve los datos en JSON.
// El archivo NO se guarda: se envía a la IA y se descarta. Si un dato no aparece, va a null.
require __DIR__ . '/ia-comun.php';
af_json_headers();

function fail($reason) { af_out(['ok' => false, 'reason' => $reason]); }

af_guard_post();
$MAX_BYTES = 10 * 1024 * 1024;

if (empty($_FILES['documento']) || !is_uploaded_file($_FILES['documento']['tmp_name'] ?? '')) fail('sin_archivo');
$f = $_FILES['documento'];
if (($f['error'] ?? 1) !== 0) fail(($f['error'] ?? 0) == UPLOAD_ERR_INI_SIZE || ($f['error'] ?? 0) == UPLOAD_ERR_FORM_SIZE ? 'tamano' : 'subida');
if (($f['size'] ?? 0) <= 0 || $f['size'] > $MAX_BYTES) fail('tamano');

$mime = '';
if (function_exists('finfo_open')) {
  $fi = finfo_open(FILEINFO_MIME_TYPE);
  $mime = (string) finfo_file($fi, $f['tmp_name']);
  finfo_close($fi);
}
if ($mime === '' || $mime === 'application/octet-stream') $mime = (string) ($f['type'] ?? '');
$mime = strtolower(trim($mime));
if ($mime === 'image/jpg') $mime = 'image/jpeg';
$allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
if (!in_array($mime, $allowed, true)) fail('tipo');

$rate = af_rate('doc', 6, 40, 400);
if ($rate) fail($rate);

$key = af_gemini_key();
if ($key === '') fail('sin_clave');

$bytes = @file_get_contents($f['tmp_name']);
if ($bytes === false || $bytes === '') fail('subida');

$hoy = date('Y-m-d');
$INSTR = <<<TXT
Eres un extractor de datos de documentos veterinarios de perros y gatos (cartillas o pasaportes de vacunación, informes clínicos). Hoy es $hoy.
Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin texto adicional, sin ```), con EXACTAMENTE esta estructura:
{
  "es_documento_veterinario": true/false,
  "tipo_documento": "cartilla" | "informe" | "otro",
  "mascota": {
    "nombre": string o null,
    "especie": "perro" | "gato" | null,
    "raza": string o null,
    "sexo": "macho" | "hembra" | null,
    "fecha_nacimiento": "AAAA-MM-DD" o null,
    "microchip": string o null,
    "peso_kg": number o null
  },
  "vacunas": [ { "nombre": string, "tipo": "polivalente_perro" | "rabia" | "leishmania" | "tos_perreras" | "trivalente_gato" | "leucemia_felina" | "otra", "fecha": "AAAA-MM-DD" o null, "proxima": "AAAA-MM-DD" o null } ],
  "desparasitaciones": [ { "tipo": "interna" | "externa" | "desconocida", "producto": string o null, "fecha": "AAAA-MM-DD" o null } ],
  "tratamientos": [ string ],
  "diagnosticos": [ string ],
  "alergias": [ string ],
  "observaciones": string o null
}
Reglas:
- Lee las pegatinas de las vacunas: el nombre comercial (p. ej. Nobivac, Canigen, Eurican, Versican, Vanguard, Rabisin, Letifend, CaniLeish, Purevax, Felocell, Leucogen) y la fecha sellada o escrita junto a ellas.
- "tipo": clasifica cada vacuna. Polivalentes de perro (DHPPi, DHP, L4, moquillo, parvovirus, hepatitis, leptospirosis, "puppy") → "polivalente_perro". Antirrábica → "rabia". Trivalente felina (RCP, panleucopenia, rinotraqueitis, calicivirus) → "trivalente_gato". FeLV → "leucemia_felina". Bordetella/KC → "tos_perreras". Si no lo sabes → "otra".
- Fechas en formato AAAA-MM-DD. En España se escriben día/mes/año: 05/03/24 es 2024-03-05. Si solo hay mes y año, usa el día 01. Si no puedes leer una fecha con seguridad, null.
- "proxima" solo si el documento indica explícitamente la fecha de la siguiente dosis o revacunación.
- Antiparasitarios (Milbemax, Drontal, Endogard, Bravecto, NexGard, Simparica, Advocate, Stronghold, Frontline, Advantix, Scalibor, Seresto…): interna si es contra gusanos, externa si es contra pulgas/garrapatas/mosquitos; si cubre ambas, "interna".
- Si un dato no aparece o no se puede leer con seguridad, pon null o una lista vacía. NO INVENTES NADA.
- Si el documento no es veterinario, "es_documento_veterinario": false y el resto vacío.
TXT;

$payload = [
  'contents' => [[
    'role'  => 'user',
    'parts' => [
      ['inline_data' => ['mime_type' => $mime, 'data' => base64_encode($bytes)]],
      ['text' => $INSTR],
    ],
  ]],
  'generationConfig' => ['temperature' => 0.1, 'maxOutputTokens' => 2500, 'responseMimeType' => 'application/json'],
];
unset($bytes);

list($text, $err) = af_gemini($key, $payload, ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest'], 60);
$parsed = $text !== '' ? af_extract_json($text) : null;
if (!$parsed) { @error_log('[amigofiel-doc] ' . $err . ' ' . substr($text, 0, 200)); fail('ia'); }
if (isset($parsed['es_documento_veterinario']) && $parsed['es_documento_veterinario'] === false) fail('no_documento');

// --- Validar y sanear todo lo que devuelve la IA ---
$VTIPOS = ['polivalente_perro', 'rabia', 'leishmania', 'tos_perreras', 'trivalente_gato', 'leucemia_felina', 'otra'];
$m = is_array($parsed['mascota'] ?? null) ? $parsed['mascota'] : [];
$esp = af_str($m['especie'] ?? null, 10);
$sexo = af_str($m['sexo'] ?? null, 10);
$peso = af_num($m['peso_kg'] ?? null);
$out = [
  'tipo_documento' => in_array($parsed['tipo_documento'] ?? '', ['cartilla', 'informe', 'otro'], true) ? $parsed['tipo_documento'] : null,
  'mascota' => [
    'nombre'           => af_str($m['nombre'] ?? null, 40),
    'especie'          => in_array($esp, ['perro', 'gato'], true) ? $esp : null,
    'raza'             => af_str($m['raza'] ?? null, 60),
    'sexo'             => in_array($sexo, ['macho', 'hembra'], true) ? $sexo : null,
    'fecha_nacimiento' => af_date($m['fecha_nacimiento'] ?? null),
    'microchip'        => af_str($m['microchip'] ?? null, 30),
    'peso_kg'          => ($peso !== null && $peso > 0 && $peso < 120) ? $peso : null,
  ],
  'vacunas' => [],
  'desparasitaciones' => [],
  'tratamientos' => [],
  'diagnosticos' => [],
  'alergias' => [],
  'observaciones' => af_str($parsed['observaciones'] ?? null, 300),
];
foreach (array_slice(is_array($parsed['vacunas'] ?? null) ? $parsed['vacunas'] : [], 0, 40) as $v) {
  if (!is_array($v)) continue;
  $nombre = af_str($v['nombre'] ?? null, 80);
  $fecha = af_date($v['fecha'] ?? null);
  if (!$nombre && !$fecha) continue;
  $out['vacunas'][] = [
    'nombre'  => $nombre,
    'tipo'    => in_array($v['tipo'] ?? '', $VTIPOS, true) ? $v['tipo'] : 'otra',
    'fecha'   => $fecha,
    'proxima' => af_date($v['proxima'] ?? null),
  ];
}
foreach (array_slice(is_array($parsed['desparasitaciones'] ?? null) ? $parsed['desparasitaciones'] : [], 0, 40) as $d) {
  if (!is_array($d)) continue;
  $fecha = af_date($d['fecha'] ?? null);
  $prod = af_str($d['producto'] ?? null, 60);
  if (!$fecha && !$prod) continue;
  $out['desparasitaciones'][] = [
    'tipo'     => in_array($d['tipo'] ?? '', ['interna', 'externa'], true) ? $d['tipo'] : 'desconocida',
    'producto' => $prod,
    'fecha'    => $fecha,
  ];
}
foreach (['tratamientos', 'diagnosticos', 'alergias'] as $k) {
  foreach (array_slice(is_array($parsed[$k] ?? null) ? $parsed[$k] : [], 0, 10) as $s) {
    $s = af_str($s, 120);
    if ($s) $out[$k][] = $s;
  }
}

af_out(['ok' => true, 'data' => $out]);
