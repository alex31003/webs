# Makeup Jhada Beauty Studio · Landing page

Web de una sola página (HTML + CSS + JavaScript, sin librerías ni compilación) para Dayana Peñafiel · Guayaquil, Ecuador.

## Qué subir a Hostinger (carpeta `public_html`)

```
index.html
styles.css
main.js
chat-jhada.php
.htaccess
img/            ← las 27 imágenes
```

No subas `herramientas/` ni este `LEEME.md`.

## Cambiar una imagen

1. Hostinger → **File Manager** → `public_html/img`
2. Sube tu foto real con **exactamente el mismo nombre** (por ejemplo `servicio-novia.jpg`) y acepta reemplazar.
3. Recarga la web con Ctrl + F5.

La lista completa de las 27 imágenes, con lo que debe mostrar cada una, está al final de `index.html`.
Consejos: JPG de menos de 400 KB. Usa formato vertical 4:5 para servicios y antes/después. Cada pareja antes/después debe tener el mismo encuadre.

> Las imágenes que trae ahora son **de muestra**, con la marca y la paleta del estudio, para que la web se vea completa desde el primer día.
> Para generar fotos realistas con IA hay un script listo: `node herramientas/generar-imagenes-ia.mjs --clave clave-openai.txt`
> (necesita una clave de OpenAI con saldo; genera las 27 con los mismos nombres).

## Activar el chat Jhada ✨ con Claude

1. Crea una clave en https://console.anthropic.com → **API Keys** (empieza por `sk-ant-`).
2. Abre `chat-jhada.php` en el File Manager y pégala donde dice `INSERTAR API KEY DE CLAUDE AQUÍ`:
   `$CLAUDE_API_KEY = 'sk-ant-...';`
3. Listo. Sin clave, el chat igual funciona con respuestas preparadas (precios reales) y ofrece el botón «Hablar directamente con Dayana».

La clave se queda en el servidor: quien visita la web nunca puede verla. El archivo también limita los mensajes por persona y por día, para cuidar tu saldo.
Para gastar menos, cambia el modelo en `chat-jhada.php` a `'claude-haiku-5-5'`.

## Datos para actualizar (marcados en el código)

- `<!-- DATO DE EJEMPLO - ACTUALIZAR CON HORARIO REAL -->` → horario (Lun–Sáb 8am–7pm)
- `<!-- DATO DE EJEMPLO - ACTUALIZAR CON DIRECCIÓN REAL -->` → dirección
- `<!-- TESTIMONIO DE EJEMPLO - REEMPLAZAR CON REAL -->` → los 4 testimonios
- `og:url` / `og:image` en el `<head>` → el dominio final

## WhatsApp

Todos los botones abren WhatsApp al **0981943602** (`wa.me/593981943602`) con un mensaje ya escrito según el botón.
