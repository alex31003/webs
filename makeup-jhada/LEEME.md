# Makeup Jhada Beauty Studio — web

Landing premium (HTML/CSS/JS sin compilación) + asistente «Jhada ✨» y Planificador de Look con IA (Claude, vía PHP).

## Estructura
- `index.html`, `styles.css`, `main.js`, `lib/` — la web.
- `api/config.php` — **precios y datos reales** (única fuente de verdad para la IA). `lib/manifest.js` repite los precios para el navegador.
- `api/chat.php` (asistente), `api/plan.php` (planificador), `api/lead.php` (guarda contactos).
- `setup.php` — pegar la clave de Claude (sk-ant-…) y crear la contraseña del panel.
- `leads.php` — panel privado de contactos (descarga CSV).
- `assets/img/` — imágenes WebP. Faltan: `hero, eyes, lips, studio, social, xv, novia, fotos, clases` (mientras tanto se ven marcos artísticos).

## Antes de publicar
`cd api && composer install` (instala la librería oficial de Claude en `api/vendor/`, que no se sube a git).

## Datos de ejemplo por reemplazar
Dirección, horario, duraciones de sesión, testimonios y logo (recreación vectorial en `assets/logo-mj.svg` y en el `<symbol id="mj-logo">` de `index.html`).
