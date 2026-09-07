#!/usr/bin/env python3
"""
Video Editor v2 - Estilo "Screen Recording + Webcam" (@migue.baena / TikTok educativo)
Adaptable a cualquier video con colores y textos personalizables.
"""

import subprocess
import os
import argparse
import json

DEFAULT_CONFIG = {
    "bg_dark":           "0x0D0D0D",
    "accent_blue":       "0x3B82F6",
    "accent_orange":     "0xF97316",
    "text_gray":         "0x9CA3AF",
    "font_bold":         "Arial-Bold",
    "font_mono":         "Courier",
    "font_size_caption": 34,
    "font_size_num":     90,
    "font_size_name":    72,
    "font_size_sub":     28,
    "watermark_size":    24,
    "out_w": 576,
    "out_h": 1024,
    "split_ratio": 0.55,
    "tint_r": 0.85,
    "tint_g": 0.90,
    "tint_b": 1.10,
}


def run(cmd, label):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"❌ {label}\n{r.stderr[-600:]}")
        return False
    print(f"✅ {label}")
    return True


def esc(s):
    return s.replace("'", "’").replace(":", "\\:").replace(",", "\\,").replace("[", "\\[").replace("]", "\\]")


def make_split_screen(content, speaker, output, caption="", watermark="@usuario", config=None):
    """Arriba: contenido/pantalla. Abajo: webcam con color grading azul."""
    c = {**DEFAULT_CONFIG, **(config or {})}
    w, h = c["out_w"], c["out_h"]
    sy = int(h * c["split_ratio"])
    sh = h - sy
    # Ensure even heights
    sy = sy if sy % 2 == 0 else sy - 1
    sh = h - sy
    cap, wm = esc(caption), esc(watermark)
    r, g, b = c["tint_r"], c["tint_g"], c["tint_b"]
    cap_y = sy + sh // 2 + 50

    fc = (
        f"[0:v]scale={w}:{sy}:force_original_aspect_ratio=increase,crop={w}:{sy}[top];"
        f"[1:v]scale={w}:{sh}:force_original_aspect_ratio=increase,crop={w}:{sh},"
        f"lutrgb=r=val*{r}:g=val*{g}:b=val*{b}[bot];"
        f"[top][bot]vstack=inputs=2,"
        f"drawtext=text='{cap}':fontsize={c['font_size_caption']}:fontcolor=white"
        f":x=(w-text_w)/2:y={cap_y}:font={c['font_bold']}:shadowcolor=black:shadowx=2:shadowy=2,"
        f"drawtext=text='{wm}':fontsize={c['watermark_size']}:fontcolor=white@0.7"
        f":x=w-text_w-20:y=h-55:font={c['font_bold']}[out]"
    )
    return run([
        "ffmpeg", "-i", content, "-i", speaker,
        "-filter_complex", fc,
        "-map", "[out]", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k", "-y", output
    ], f"Split screen → {os.path.basename(output)}")


def make_fullscreen_speaker(speaker, output, caption="", watermark="@usuario", config=None):
    """Webcam a pantalla completa con grading azul y caption."""
    c = {**DEFAULT_CONFIG, **(config or {})}
    w, h = c["out_w"], c["out_h"]
    cap, wm = esc(caption), esc(watermark)
    r, g, b = c["tint_r"], c["tint_g"], c["tint_b"]

    vf = (
        f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
        f"lutrgb=r=val*{r}:g=val*{g}:b=val*{b},"
        f"drawtext=text='{cap}':fontsize={c['font_size_caption']}:fontcolor=white"
        f":x=(w-text_w)/2:y=h-200:font={c['font_bold']}:shadowcolor=black:shadowx=2:shadowy=2,"
        f"drawtext=text='{wm}':fontsize={c['watermark_size']}:fontcolor=white@0.7"
        f":x=w-text_w-20:y=h-55:font={c['font_bold']}"
    )
    return run([
        "ffmpeg", "-i", speaker,
        "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k", "-y", output
    ], f"Fullscreen speaker → {os.path.basename(output)}")


def make_section_card(output, number="1°", name="HERRAMIENTA", subtitle="", commands=None,
                      duration=3.0, config=None, audio=None):
    """Tarjeta oscura: número neón + nombre retro + comandos a la derecha."""
    c = {**DEFAULT_CONFIG, **(config or {})}
    w, h = c["out_w"], c["out_h"]
    num, nm, sub = esc(number), esc(name), esc(subtitle)
    cmds = commands or []

    name_y = 240
    sub_y = name_y + c["font_size_name"] + 20

    # Build drawtext chain (without color source - that goes in -f lavfi)
    dt = (
        f"drawtext=text='{num}':fontsize={c['font_size_num']}:fontcolor={c['accent_blue']}"
        f":x=40:y=100:font={c['font_bold']}:shadowcolor={c['accent_blue']}@0.5:shadowx=3:shadowy=3,"
        f"drawtext=text='{nm}':fontsize={c['font_size_name']}:fontcolor={c['accent_orange']}"
        f":x=40:y={name_y}:font={c['font_bold']},"
        f"drawtext=text='{sub}':fontsize={c['font_size_sub']}:fontcolor={c['text_gray']}"
        f":x=40:y={sub_y}:font={c['font_bold']}"
    )
    for i, ct in enumerate(cmds[:7]):
        ct_esc = esc(ct)
        y = int(h * 0.44) + i * 52
        dt += (
            f",drawtext=text='{ct_esc}':fontsize=28:fontcolor={c['text_gray']}"
            f":x=w-text_w-40:y={y}:font={c['font_mono']}"
        )

    lavfi_src = f"color={c['bg_dark']}:size={w}x{h}:duration={duration}:rate=30"
    if audio:
        cmd = [
            "ffmpeg",
            "-f", "lavfi", "-i", lavfi_src,
            "-i", audio,
            "-vf", dt,
            "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-preset", "fast", "-crf", "20",
            "-c:a", "aac", "-b:a", "128k", "-t", str(duration), "-y", output
        ]
    else:
        cmd = [
            "ffmpeg",
            "-f", "lavfi", "-i", lavfi_src,
            "-vf", dt,
            "-c:v", "libx264", "-preset", "fast", "-crf", "20",
            "-y", output
        ]
    return run(cmd, f"Sección '{name}' → {os.path.basename(output)}")


def make_outro(output, username="@usuario", platform="TikTok", duration=3.0, config=None):
    """Pantalla negra final con plataforma y @usuario en search bar."""
    c = {**DEFAULT_CONFIG, **(config or {})}
    w, h = c["out_w"], c["out_h"]
    plat, user = esc(platform), esc(username)
    mid = h // 2

    vf = (
        f"drawtext=text='{plat}':fontsize=80:fontcolor=white"
        f":x=(w-text_w)/2:y={mid - 120}:font={c['font_bold']},"
        f"drawbox=x=60:y={mid + 20}:w={w - 120}:h=70:color=white@0.2:t=fill,"
        f"drawbox=x=60:y={mid + 20}:w={w - 120}:h=70:color=white@0.5:t=2,"
        f"drawtext=text='@ {user}':fontsize=32:fontcolor=white@0.9"
        f":x=(w-text_w)/2:y={mid + 42}:font={c['font_bold']}"
    )
    return run([
        "ffmpeg",
        "-f", "lavfi", "-i", f"color={c['bg_dark']}:size={w}x{h}:duration={duration}:rate=30",
        "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-y", output
    ], f"Outro → {os.path.basename(output)}")


def concat_videos(video_list, output):
    """Une múltiples clips en un solo video."""
    lst = output + "_list.txt"
    with open(lst, "w") as f:
        for v in video_list:
            f.write(f"file '{os.path.abspath(v)}'\n")
    ok = run([
        "ffmpeg", "-f", "concat", "-safe", "0", "-i", lst,
        "-c", "copy", "-y", output
    ], f"Concat {len(video_list)} clips → {os.path.basename(output)}")
    os.remove(lst)
    return ok


if __name__ == "__main__":
    p = argparse.ArgumentParser(
        description="Editor estilo TikTok educativo (screen + webcam)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EJEMPLOS:
  python3 editor_v2.py split --content pantalla.mp4 --speaker webcam.mp4 \\
      --caption "Google ya te conoce" --watermark "@migue.baena" -o out.mp4

  python3 editor_v2.py section --number "2°" --name "CLAUDE" \\
      --subtitle "AI-Powered SEO" --commands "/audit url,/schema url,/geo url" -o card.mp4

  python3 editor_v2.py outro --username "migue.baena" -o outro.mp4

  python3 editor_v2.py fullscreen --speaker webcam.mp4 --caption "te lo enseño" -o full.mp4

  python3 editor_v2.py concat --videos "card.mp4,split.mp4,outro.mp4" -o final.mp4

PERSONALIZAR COLORES:
  --accent-blue "#00D4FF" --accent-orange "#FF6B00"
"""
    )
    p.add_argument("mode", choices=["split", "fullscreen", "section", "outro", "concat"])
    p.add_argument("-o", "--output", default="output.mp4")
    p.add_argument("--config")
    p.add_argument("--content")
    p.add_argument("--speaker")
    p.add_argument("--caption", default="")
    p.add_argument("--watermark", default="@usuario")
    p.add_argument("--number", default="1°")
    p.add_argument("--name", default="HERRAMIENTA")
    p.add_argument("--subtitle", default="")
    p.add_argument("--commands", default="")
    p.add_argument("--duration", type=float, default=3.0)
    p.add_argument("--audio")
    p.add_argument("--username", default="@usuario")
    p.add_argument("--platform", default="TikTok")
    p.add_argument("--videos")
    p.add_argument("--accent-blue")
    p.add_argument("--accent-orange")
    p.add_argument("--bg-dark")
    args = p.parse_args()

    cfg = {}
    if args.config:
        with open(args.config) as f:
            cfg = json.load(f)
    if args.accent_blue:
        cfg["accent_blue"] = args.accent_blue.replace("#", "0x")
    if args.accent_orange:
        cfg["accent_orange"] = args.accent_orange.replace("#", "0x")
    if args.bg_dark:
        cfg["bg_dark"] = args.bg_dark.replace("#", "0x")

    if args.mode == "split":
        assert args.content and args.speaker, "--content y --speaker requeridos"
        make_split_screen(args.content, args.speaker, args.output, args.caption, args.watermark, cfg)
    elif args.mode == "fullscreen":
        assert args.speaker, "--speaker requerido"
        make_fullscreen_speaker(args.speaker, args.output, args.caption, args.watermark, cfg)
    elif args.mode == "section":
        cmds = [x.strip() for x in args.commands.split(",")] if args.commands else []
        make_section_card(args.output, args.number, args.name, args.subtitle, cmds, args.duration, cfg, args.audio)
    elif args.mode == "outro":
        make_outro(args.output, args.username, args.platform, args.duration, cfg)
    elif args.mode == "concat":
        assert args.videos, "--videos requerido"
        concat_videos([v.strip() for v in args.videos.split(",")], args.output)
