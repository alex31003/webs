#!/usr/bin/env python3
"""
Video Editor v3 - Estilo ÚNICO combinado
- Split screen: contenido arriba + speaker abajo (siempre video, nunca texto solo)
- Tinte verde oscuro sutil en arriba, neutro-cálido en speaker
- Barra mostaza arriba y en divisor entre secciones
- Texto verde claro (#4ADE80) para títulos principales
- Mostaza (#D4A017) para captions de acción
- Blanco para texto secundario
- Negro para fondos cuando sea necesario
- Nunca un segundo sin video activo
"""

import subprocess, os, argparse, json

CONFIG = {
    "green_light":   "0x4ADE80",   # Verde claro — títulos principales
    "mustard":       "0xD4A017",   # Mostaza — captions, barras, divisores
    "green_dark_bg": "0x0F2318",   # Verde oscuro — fondos de overlay
    "white":         "white",
    "black":         "black",
    "font":          "Arial-Bold",
    "font_mono":     "Courier",
    "out_w":         576,
    "out_h":         1024,
    "split_ratio":   0.545,        # contenido arriba / speaker abajo
    # Tintes sutiles (valores cercanos a 1.0 = casi neutro)
    "top_r": 0.92, "top_g": 1.00, "top_b": 0.88,  # verde frío arriba
    "bot_r": 0.88, "bot_g": 0.97, "bot_b": 0.82,  # verde cálido abajo
}


def esc(s):
    return (s.replace("'", "")
             .replace(":", "\\:")
             .replace(",", "\\,")
             .replace("[", "")
             .replace("]", ""))


def run(cmd, label):
    r = subprocess.run(cmd, capture_output=True, text=True)
    ok = r.returncode == 0
    print(("✅" if ok else "❌") + f" {label}")
    if not ok:
        print(r.stderr[-500:])
    return ok


def make_split(content, speaker, output,
               title="",          # Verde claro, esquina superior izquierda
               subtitle="",       # Blanco, debajo del título
               caption="",        # Mostaza bold, sobre el speaker
               caption2="",       # Blanco, segunda línea sobre speaker
               watermark="@usuario",
               config=None):
    """
    El modo principal: video arriba + speaker abajo.
    SIEMPRE hay video en movimiento — nunca fondo vacío.
    Overlay de textos sobre los videos.
    """
    c = {**CONFIG, **(config or {})}
    w, h = c["out_w"], c["out_h"]
    sy = int(h * c["split_ratio"])
    sy = sy - (sy % 2)             # must be even
    sh = h - sy
    sh = sh - (sh % 2)

    t, s, cap, cap2, wm = esc(title), esc(subtitle), esc(caption), esc(caption2), esc(watermark)
    tr, tg, tb = c["top_r"], c["top_g"], c["top_b"]
    br, bg, bb = c["bot_r"], c["bot_g"], c["bot_b"]

    cap_y  = sy + 22
    cap2_y = sy + 68

    fc = (
        # ── Arriba: contenido con tinte verde sutil ──────────────────────────
        f"[0:v]scale={w}:{sy}:force_original_aspect_ratio=increase,"
        f"crop={w}:{sy},"
        f"lutrgb=r=val*{tr}:g=val*{tg}:b=val*{tb}[top];"

        # ── Abajo: speaker con tinte verde-cálido sutil ──────────────────────
        f"[1:v]scale={w}:{sh}:force_original_aspect_ratio=increase,"
        f"crop={w}:{sh},"
        f"lutrgb=r=val*{br}:g=val*{bg}:b=val*{bb}[bot];"

        # ── Stack + overlays ─────────────────────────────────────────────────
        f"[top][bot]vstack=inputs=2,"

        # Barra mostaza top (7px)
        f"drawbox=x=0:y=0:w={w}:h=7:color={c['mustard']}:t=fill,"

        # Línea mostaza divisora
        f"drawbox=x=0:y={sy}:w={w}:h=5:color={c['mustard']}:t=fill,"

        # Título verde claro — esquina superior izquierda sobre el contenido
        + (f"drawtext=text='{t}':fontsize=46:fontcolor={c['green_light']}:"
           f"x=18:y=16:font={c['font']}:shadowcolor=black@0.95:shadowx=2:shadowy=2," if t else "")

        # Subtítulo blanco
        + (f"drawtext=text='{s}':fontsize=26:fontcolor=white:"
           f"x=18:y=72:font={c['font']}:shadowcolor=black@0.9:shadowx=1:shadowy=1," if s else "")

        # Caption mostaza — primera línea sobre el speaker
        + (f"drawtext=text='{cap}':fontsize=34:fontcolor={c['mustard']}:"
           f"x=(w-text_w)/2:y={cap_y}:font={c['font']}:"
           f"shadowcolor=black:shadowx=2:shadowy=2," if cap else "")

        # Caption blanco — segunda línea
        + (f"drawtext=text='{cap2}':fontsize=28:fontcolor=white:"
           f"x=(w-text_w)/2:y={cap2_y}:font={c['font']}:"
           f"shadowcolor=black:shadowx=1:shadowy=1," if cap2 else "")

        # Watermark
        + f"drawtext=text='{wm}':fontsize=21:fontcolor=white@0.8:"
          f"x=w-text_w-14:y=h-44:font={c['font']}[out]"
    )

    return run([
        "ffmpeg", "-i", content, "-i", speaker,
        "-filter_complex", fc,
        "-map", "[out]", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k", "-y", output
    ], f"Split → {os.path.basename(output)}")


def make_fullscreen(speaker, output,
                    caption="", caption2="", watermark="@usuario", config=None):
    """Speaker a pantalla completa. Siempre video activo + texto encima."""
    c = {**CONFIG, **(config or {})}
    w, h = c["out_w"], c["out_h"]
    cap, cap2, wm = esc(caption), esc(caption2), esc(watermark)
    br, bg, bb = c["bot_r"], c["bot_g"], c["bot_b"]

    vf = (
        f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
        f"lutrgb=r=val*{br}:g=val*{bg}:b=val*{bb},"
        f"drawbox=x=0:y=0:w={w}:h=7:color={c['mustard']}:t=fill"
        + (f",drawtext=text='{cap}':fontsize=40:fontcolor={c['mustard']}:"
           f"x=(w-text_w)/2:y=h-210:font={c['font']}:shadowcolor=black:shadowx=2:shadowy=2" if cap else "")
        + (f",drawtext=text='{cap2}':fontsize=30:fontcolor=white:"
           f"x=(w-text_w)/2:y=h-158:font={c['font']}:shadowcolor=black:shadowx=1:shadowy=1" if cap2 else "")
        + f",drawtext=text='{wm}':fontsize=21:fontcolor=white@0.8:"
          f"x=w-text_w-14:y=h-44:font={c['font']}"
    )
    return run([
        "ffmpeg", "-i", speaker, "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k", "-y", output
    ], f"Fullscreen → {os.path.basename(output)}")


def make_section_over_video(video, output,
                             number="1°", name="HERRAMIENTA",
                             subtitle="", commands=None, config=None):
    """
    Tarjeta de sección pero CON video de fondo oscuro.
    Semi-overlay verde oscuro sobre el video — nunca pantalla vacía.
    """
    c = {**CONFIG, **(config or {})}
    w, h = c["out_w"], c["out_h"]
    num, nm, sub = esc(number), esc(name), esc(subtitle)
    cmds = commands or []

    # Overlay oscuro semitransparente verde para legibilidad
    vf = (
        f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
        f"lutrgb=r=val*0.25:g=val*0.35:b=val*0.22,"   # oscurecer mucho
        f"drawbox=x=0:y=0:w={w}:h=7:color={c['mustard']}:t=fill,"
        f"drawtext=text='{num}':fontsize=88:fontcolor={c['green_light']}:"
        f"x=35:y=95:font={c['font']}:shadowcolor=black@0.8:shadowx=3:shadowy=3,"
        f"drawtext=text='{nm}':fontsize=70:fontcolor={c['mustard']}:"
        f"x=35:y=230:font={c['font']}:shadowcolor=black@0.8:shadowx=2:shadowy=2,"
        f"drawtext=text='{sub}':fontsize=26:fontcolor=white@0.8:"
        f"x=35:y={230 + 70 + 18}:font={c['font']}"
    )
    for i, ct in enumerate(cmds[:7]):
        ct_e = esc(ct)
        y = int(h * 0.44) + i * 52
        vf += (f",drawtext=text='{ct_e}':fontsize=27:fontcolor=white@0.65:"
               f"x=w-text_w-35:y={y}:font={c['font_mono']}")

    return run([
        "ffmpeg", "-i", video, "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-c:a", "aac", "-b:a", "128k", "-y", output
    ], f"Sección sobre video → {os.path.basename(output)}")


def make_outro_over_video(video, output, username="@usuario",
                           platform="", config=None):
    """Outro con video de fondo muy oscuro + texto."""
    c = {**CONFIG, **(config or {})}
    w, h = c["out_w"], c["out_h"]
    user, plat = esc(username), esc(platform)
    mid = h // 2

    vf = (
        f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
        f"lutrgb=r=val*0.15:g=val*0.22:b=val*0.13,"
        f"drawbox=x=0:y=0:w={w}:h=7:color={c['mustard']}:t=fill,"
        + (f"drawtext=text='{plat}':fontsize=72:fontcolor=white:"
           f"x=(w-text_w)/2:y={mid-130}:font={c['font']}," if plat else "")
        + f"drawbox=x=55:y={mid+10}:w={w-110}:h=68:color={c['mustard']}@0.15:t=fill,"
          f"drawbox=x=55:y={mid+10}:w={w-110}:h=68:color={c['mustard']}@0.6:t=2,"
          f"drawtext=text='@ {user}':fontsize=32:fontcolor=white:"
          f"x=(w-text_w)/2:y={mid+30}:font={c['font']}"
    )
    return run([
        "ffmpeg", "-i", video, "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-c:a", "aac", "-b:a", "128k", "-y", output
    ], f"Outro → {os.path.basename(output)}")


def concat_videos(video_list, output):
    lst = output + "_list.txt"
    with open(lst, "w") as f:
        for v in video_list:
            f.write(f"file '{os.path.abspath(v)}'\n")
    ok = run(["ffmpeg", "-f", "concat", "-safe", "0", "-i", lst,
              "-c", "copy", "-y", output],
             f"Concat {len(video_list)} clips → {os.path.basename(output)}")
    os.remove(lst)
    return ok


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    p = argparse.ArgumentParser(
        description="Editor v3 — Estilo único verde/mostaza, siempre video activo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
MODOS:
  split      Contenido arriba + speaker abajo (modo principal)
  fullscreen Solo speaker pantalla completa con captions
  section    Sección numerada CON video de fondo (nunca pantalla negra)
  outro      Cierre CON video de fondo muy oscuro
  concat     Une clips en secuencia

COLORES PERSONALIZABLES:
  --green "#4ADE80"   Color del título principal
  --mustard "#D4A017" Color del caption y barras

EJEMPLOS:
  python3 editor_v3.py split \\
    --content grabacion.mp4 --speaker camara.mp4 \\
    --title "VENDE MAS" --subtitle "enseñando una sola cosa" \\
    --caption "GOOGLE YA TE CONOCE" --caption2 "te lo enseño ahora" \\
    --watermark "@tu_usuario" -o clip.mp4

  python3 editor_v3.py section --video speaker.mp4 \\
    --number "1°" --name "CHATGPT" --subtitle "Generacion de contenido" \\
    --commands "Escribe posts,Crea guiones,Genera ideas" -o sec.mp4

  python3 editor_v3.py outro --video speaker.mp4 \\
    --username "tu_usuario" --platform "Instagram" -o outro.mp4

  python3 editor_v3.py concat --videos "sec.mp4,clip.mp4,outro.mp4" -o final.mp4
"""
    )
    p.add_argument("mode", choices=["split","fullscreen","section","outro","concat"])
    p.add_argument("-o", "--output", default="output.mp4")
    p.add_argument("--content")
    p.add_argument("--speaker")
    p.add_argument("--video", help="Video de fondo para section/outro/fullscreen")
    p.add_argument("--title", default="")
    p.add_argument("--subtitle", default="")
    p.add_argument("--caption", default="")
    p.add_argument("--caption2", default="")
    p.add_argument("--watermark", default="@usuario")
    p.add_argument("--number", default="1°")
    p.add_argument("--name", default="HERRAMIENTA")
    p.add_argument("--commands", default="")
    p.add_argument("--username", default="@usuario")
    p.add_argument("--platform", default="")
    p.add_argument("--videos")
    p.add_argument("--green")
    p.add_argument("--mustard")
    p.add_argument("--config")
    args = p.parse_args()

    cfg = {}
    if args.config:
        with open(args.config) as f: cfg = json.load(f)
    if args.green:   cfg["green_light"] = args.green.replace("#","0x")
    if args.mustard: cfg["mustard"]     = args.mustard.replace("#","0x")

    spk = args.speaker or args.video or args.content

    if args.mode == "split":
        assert args.content and args.speaker, "--content y --speaker requeridos"
        make_split(args.content, args.speaker, args.output,
                   args.title, args.subtitle, args.caption, args.caption2,
                   args.watermark, cfg)
    elif args.mode == "fullscreen":
        assert spk, "--speaker o --video requerido"
        make_fullscreen(spk, args.output, args.caption, args.caption2, args.watermark, cfg)
    elif args.mode == "section":
        assert spk, "--video requerido"
        cmds = [x.strip() for x in args.commands.split(",")] if args.commands else []
        make_section_over_video(spk, args.output, args.number, args.name,
                                args.subtitle, cmds, cfg)
    elif args.mode == "outro":
        assert spk, "--video requerido"
        make_outro_over_video(spk, args.output, args.username, args.platform, cfg)
    elif args.mode == "concat":
        assert args.videos, "--videos requerido"
        concat_videos([v.strip() for v in args.videos.split(",")], args.output)
