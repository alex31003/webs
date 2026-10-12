#!/usr/bin/env node
// =============================================================================
// Genera las 27 imágenes de Makeup Jhada con IA (OpenAI gpt-image-2) y las
// guarda en ../img con los nombres exactos que usa la web.
//
// Uso (Node 18+):
//   node herramientas/generar-imagenes-ia.mjs --clave clave-openai.txt
//   node herramientas/generar-imagenes-ia.mjs --clave clave-openai.txt --solo hero-dayana.jpg,galeria-2.jpg
//   Opciones: --calidad low|medium|high (por defecto medium) · --paralelo 4 (imágenes a la vez)
//
// - Las fotos "despues-*.jpg" se generan a partir de su "antes-*.jpg" para que
//   sea la MISMA mujer (edición con referencia).
// - El logo sale en PNG con fondo transparente.
// - Esta carpeta "herramientas" NO se sube a Hostinger.
// =============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.resolve(HERE, "..", "img");

const arg = (n, d = null) => { const i = process.argv.indexOf("--" + n); return i > -1 ? process.argv[i + 1] : d; };
const claveArchivo = arg("clave");
const solo = (arg("solo", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const calidad = arg("calidad", "medium");
const paralelo = Math.max(1, parseInt(arg("paralelo", "4"), 10) || 4);
if (!claveArchivo || !fs.existsSync(claveArchivo)) {
  console.error("ERROR falta --clave <archivo con la clave de OpenAI>");
  process.exit(1);
}
const KEY = fs.readFileSync(claveArchivo, "utf8").trim();

const ESTILO = "Fotografía de revista de moda premium, editorial de belleza de lujo, iluminación de estudio suave y cálida, " +
  "paleta cálida de chocolates, dorados, nude y borgoña, sin tonos azules, verdes ni morados, piel con textura real, " +
  "nitidez profesional, lente 85mm, sin texto, sin logotipos, sin marcas de agua.";
const LATINA = "mujer latina ecuatoriana";
const NEUTRO = "fondo neutro beige liso, luz frontal suave, retrato frontal de hombros hacia arriba, expresión serena";

const IMAGENES = [
  // gpt-image-2 no admite fondo transparente: el logo incluido (diseñado aparte, PNG transparente)
  // solo se regenera si lo pides con --solo logo-mj.png, y saldrá con fondo liso.
  { f: "logo-mj.png", size: "1024x1024", fmt: "png", q: "high", manual: true,
    p: "Logotipo de lujo: monograma 'MJ' en tipografía serif elegante dorada metálica con una pequeña corona dorada encima, dentro de un círculo color chocolate oscuro (#3D1C1C) con doble aro dorado fino, debajo la frase 'BEAUTY STUDIO' en mayúsculas espaciadas doradas. Fondo liso color nude claro, diseño plano vectorial, centrado." },
  { f: "hero-dayana.jpg", size: "1536x1024", q: "high",
    p: `${LATINA} maquilladora profesional de unos 28 años, cabello largo castaño rojizo con ondas, sosteniendo un pincel de maquillaje con elegancia, mirada segura a cámara, fondo oscuro chocolate con destellos dorados bokeh, ubicada en el tercio derecho del encuadre dejando espacio vacío oscuro a la izquierda. ${ESTILO}` },
  { f: "dayana-trabajando.jpg", size: "1024x1536",
    p: `Maquilladora ${LATINA} de cabello castaño rojizo aplicando base con brocha a una clienta sentada, estudio de belleza premium con espejo iluminado, tonos dorados y madera oscura. ${ESTILO}` },
  { f: "staff-grupo.jpg", size: "1536x1024",
    p: `Grupo de 4 mujeres latinas maquilladoras sonriendo juntas en un beauty studio elegante, vestidas en tonos negro y nude, ambiente cálido con luces doradas. ${ESTILO}` },
  { f: "servicio-social.jpg", size: "1024x1536",
    p: `${LATINA} joven con maquillaje de graduación natural y elegante en tonos nude y dorado, labios rosa nude, cabello en ondas suaves, vestido elegante. ${ESTILO}` },
  { f: "servicio-xv.jpg", size: "1024x1536",
    p: `Quinceañera ${LATINA} de 15 años con maquillaje glam romántico, sombras rosadas y doradas, pestañas largas, tiara delicada, peinado de princesa, vestido de gala. ${ESTILO}` },
  { f: "servicio-novia.jpg", size: "1024x1536",
    p: `Novia ${LATINA} con maquillaje nupcial impecable y luminoso, velo de tul, peinado recogido clásico, aretes de perla, look clásico atemporal. ${ESTILO}` },
  { f: "servicio-fotos.jpg", size: "1024x1536",
    p: `${LATINA} modelo con maquillaje editorial para sesión fotográfica, técnica strobing muy visible con pómulos y puente nasal iluminados en dorado, mirada intensa. ${ESTILO}` },
  { f: "servicio-clases.jpg", size: "1024x1536",
    p: `Clase de maquillaje profesional: varias alumnas latinas practicando con paletas de sombras abiertas y pinceles en una mesa, instructora explicando, ambiente de academia elegante. ${ESTILO}` },
  { f: "antes-novia.jpg", size: "1024x1536", p: `${LATINA} de 27 años sin maquillaje, piel limpia y natural, cabello castaño suelto, ${NEUTRO}. Fotografía realista.` },
  { f: "despues-novia.jpg", size: "1024x1536", ref: "antes-novia.jpg",
    p: "La MISMA mujer de la referencia, mismo rostro, mismo encuadre y mismo fondo, ahora con maquillaje nupcial completo, piel luminosa, ojos en tonos champagne, labios rosa nude, peinado recogido con velo." },
  { f: "antes-xv.jpg", size: "1024x1536", p: `Adolescente latina de 15 años sin maquillaje, piel limpia, cabello oscuro suelto, ${NEUTRO}. Fotografía realista.` },
  { f: "despues-xv.jpg", size: "1024x1536", ref: "antes-xv.jpg",
    p: "La MISMA adolescente de la referencia, mismo rostro, encuadre y fondo, ahora con maquillaje de quinceañera glam completo: sombras rosas y doradas con brillo, pestañas largas, labios gloss rosa, tiara y peinado de princesa." },
  { f: "antes-grad.jpg", size: "1024x1536", p: `${LATINA} de 22 años sin maquillaje, piel limpia, cabello castaño lacio, ${NEUTRO}. Fotografía realista.` },
  { f: "despues-grad.jpg", size: "1024x1536", ref: "antes-grad.jpg",
    p: "La MISMA mujer de la referencia, mismo rostro, encuadre y fondo, ahora con maquillaje de graduación elegante: tonos nude y bronce, delineado fino, labios terracota suave, cabello en ondas." },
  { f: "antes-glam.jpg", size: "1024x1536", p: `${LATINA} de 30 años sin maquillaje, piel limpia, cabello negro ondulado, ${NEUTRO}. Fotografía realista.` },
  { f: "despues-glam.jpg", size: "1024x1536", ref: "antes-glam.jpg",
    p: "La MISMA mujer de la referencia, mismo rostro, encuadre y fondo, ahora con maquillaje glam dramático: ojos ahumados intensos en chocolate y negro, pestañas voluminosas, contorno marcado, labios borgoña." },
  { f: "galeria-1.jpg", size: "1024x1536", p: `Primer plano extremo de los ojos de una ${LATINA} con maquillaje de ojos ahumados en tonos chocolate y dorado, pestañas largas. ${ESTILO}` },
  { f: "galeria-2.jpg", size: "1024x1024", p: `Primer plano de labios rojos perfectos con delineado impecable de una ${LATINA}, piel cálida. ${ESTILO}` },
  { f: "galeria-3.jpg", size: "1024x1024", p: `Novia ${LATINA} de perfil lateral con maquillaje nupcial completo, velo, peinado recogido con detalles dorados. ${ESTILO}` },
  { f: "galeria-4.jpg", size: "1024x1024", p: `Pinceles profesionales de maquillaje con mangos negros y férulas doradas dispuestos en abanico sobre un fondo dorado satinado, bodegón de lujo. ${ESTILO}` },
  { f: "galeria-5.jpg", size: "1024x1536", p: `Quinceañera ${LATINA} de cuerpo medio vista frontal con look completo: maquillaje glam, tiara, vestido de gala en tonos rosa palo y dorado. ${ESTILO}` },
  { f: "galeria-6.jpg", size: "1536x1024", p: `Set de sesión de fotos profesional: modelo ${LATINA} con maquillaje editorial frente a la cámara, luces de estudio cálidas, ambiente de backstage. ${ESTILO}` },
  { f: "testimonio-1.jpg", size: "1024x1024", p: `Retrato cuadrado de ${LATINA} de 28 años sonriendo con naturalidad, cabello castaño, fondo cálido desenfocado. ${ESTILO}` },
  { f: "testimonio-2.jpg", size: "1024x1024", p: `Retrato cuadrado de ${LATINA} de 24 años sonriendo, cabello negro recogido, fondo cálido desenfocado. ${ESTILO}` },
  { f: "testimonio-3.jpg", size: "1024x1024", p: `Retrato cuadrado de adolescente latina de 16 años sonriendo, cabello largo ondulado, fondo cálido desenfocado. ${ESTILO}` },
  { f: "testimonio-4.jpg", size: "1024x1024", p: `Retrato cuadrado de ${LATINA} de 32 años sonriendo, cabello castaño claro, fondo cálido desenfocado. ${ESTILO}` },
];

async function generar(img) {
  const out = path.join(IMG, img.f);
  const fmt = img.fmt || "jpeg";
  let res;
  if (img.ref) {
    const form = new FormData();
    form.append("model", "gpt-image-2");
    form.append("prompt", img.p + " " + ESTILO);
    form.append("size", img.size);
    form.append("quality", img.q || calidad);
    form.append("output_format", fmt);
    const refPath = path.join(IMG, img.ref);
    form.append("image[]", new Blob([fs.readFileSync(refPath)], { type: "image/jpeg" }), img.ref);
    res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: "Bearer " + KEY }, body: form });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-2", prompt: img.p, size: img.size, quality: img.q || calidad, output_format: fmt, ...(img.bg ? { background: img.bg } : {}) }),
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.data?.[0]?.b64_json) {
    throw new Error((data?.error?.message || "HTTP " + res.status));
  }
  fs.writeFileSync(out, Buffer.from(data.data[0].b64_json, "base64"));
  console.log("OK " + img.f);
}

const lista = solo.length ? IMAGENES.filter((i) => solo.includes(i.f)) : IMAGENES.filter((i) => !i.manual);
// Primero las que no dependen de otra; luego las "despues-*" que usan su "antes-*"
const orden = [...lista.filter((i) => !i.ref), ...lista.filter((i) => i.ref)];
let fallos = 0;
async function conReintento(img) {
  for (let intento = 1; intento <= 3; intento++) {
    try { return await generar(img); } catch (e) {
      if (intento === 3) { fallos++; console.error("ERROR " + img.f + ": " + e.message); return; }
      await new Promise((r) => setTimeout(r, 4000 * intento));
    }
  }
}
// Varias a la vez; las "despues-*" esperan a que exista su "antes-*"
async function enGrupos(lista) {
  const cola = [...lista];
  await Promise.all(Array.from({ length: paralelo }, async () => {
    while (cola.length) await conReintento(cola.shift());
  }));
}
await enGrupos(orden.filter((i) => !i.ref));
await enGrupos(orden.filter((i) => i.ref));
process.exit(fallos ? 1 : 0);
