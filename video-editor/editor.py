#!/usr/bin/env python3
"""
Video Editor - Estilo Split Screen / Full Screen
Inspirado en el estilo de contenido educativo con texto + hablante
Adaptable a cualquier video con colores personalizables
"""

import subprocess
import os
import sys
import json
import argparse
from pathlib import Path

# ─── CONFIGURACIÓN DE COLORES (personalizable) ───────────────────────────────
DEFAULT_CONFIG = {
    "accent_color": "#E85D26",       # Naranja (color principal de acento)
    "bg_color": "#F5F0EB",           # Fondo crema/blanco
    "text_primary": "#1A1A1A",       # Texto negro
    "text_secondary": "#888888",     # Texto gris
    "caption_bg": "#1A1A1A",         # Fondo de captions
    "caption_text": "#FFFFFF",       # Texto de captions
    "border_color": "#E85D26",       # Borde de boxes
    
    # Tipografía
    "font": "Arial-Bold",
    "font_size_title": 52,
    "font_size_subtitle": 28,
    "font_size_caption": 30,
    
    # Layout
    "output_width": 576,
    "output_height": 1024,
    "mode": "split",                 # "split" o "fullscreen"
    "split_ratio": 0.45,             # % de pantalla para la parte de texto (arriba)
}

def hex_to_rgb(hex_color):
    """Convierte hex a RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_ffmpeg(hex_color):
    """Convierte hex a formato ffmpeg 0xRRGGBB"""
    return hex_color.replace('#', '0x')

def build_split_screen_filter(config, texts, has_insert=False):
    """
    Construye el filtro ffmpeg para split screen con texto
    texts: dict con keys: title, subtitle, caption, label_top
    """
    w = config["output_width"]
    h = config["output_height"]
    split_y = int(h * config["split_ratio"])
    
    accent = rgb_to_ffmpeg(config["accent_color"])
    bg = rgb_to_ffmpeg(config["bg_color"])
    cap_bg = rgb_to_ffmpeg(config["caption_bg"])
    cap_text = config["caption_text"].replace('#', '')
    primary = config["text_primary"].replace('#', '')
    secondary = config["text_secondary"].replace('#', '')
    
    title = texts.get("title", "").replace("'", "\\'").replace(":", "\\:")
    subtitle = texts.get("subtitle", "").replace("'", "\\'").replace(":", "\\:")
    caption = texts.get("caption", "").replace("'", "\\'").replace(":", "\\:")
    label = texts.get("label_top", "").replace("'", "\\'").replace(":", "\\:")
    
    font_size_title = config["font_size_title"]
    font_size_sub = config["font_size_subtitle"]
    font_size_cap = config["font_size_caption"]
    
    # Filtro complejo
    filter_complex = f"""
[0:v]scale={w}:{h-split_y}:force_original_aspect_ratio=increase,
crop={w}:{h-split_y}[bottom_video];

color={bg}:{w}x{split_y}[bg_top];

[bg_top]
drawtext=text='{label}':
  fontsize={font_size_sub - 8}:
  fontcolor={secondary}:
  x=(w-text_w)/2:
  y=80:
  font=Arial:
  text_shaping=1,
drawtext=text='{subtitle}':
  fontsize={font_size_title}:
  fontcolor={primary}:
  x=60:
  y=130:
  font=Arial-Bold,
drawtext=text='{title}':
  fontsize={font_size_title}:
  fontcolor={accent}:
  x=60:
  y={130 + font_size_title + 10}:
  font=Arial-Bold[text_top];

[text_top][bottom_video]vstack=inputs=2[stacked];

[stacked]drawtext=text='{caption}':
  fontsize={font_size_cap}:
  fontcolor={cap_text}:
  x=(w-text_w)/2:
  y={h - 80}:
  font=Arial-Bold:
  box=1:
  boxcolor={cap_bg}@0.85:
  boxborderw=20[output]
"""
    return filter_complex.strip()


def build_fullscreen_filter(config, texts):
    """Filtro para video en pantalla completa con overlay de texto"""
    w = config["output_width"]
    h = config["output_height"]
    
    accent = rgb_to_ffmpeg(config["accent_color"])
    cap_text = config["caption_text"].replace('#', '')
    cap_bg = rgb_to_ffmpeg(config["caption_bg"])
    secondary = config["text_secondary"].replace('#', '')
    
    title = texts.get("title", "").replace("'", "\\'").replace(":", "\\:")
    caption = texts.get("caption", "").replace("'", "\\'").replace(":", "\\:")
    
    font_size_title = config["font_size_title"]
    font_size_cap = config["font_size_caption"]
    
    filter_complex = f"""
[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,
crop={w}:{h}[full_video];

[full_video]
drawtext=text='{title}':
  fontsize={font_size_title}:
  fontcolor={accent}:
  x=(w-text_w)/2:
  y=120:
  font=Arial-Bold:
  box=1:
  boxcolor=0xFFFFFF@0.8:
  boxborderw=15,
drawtext=text='{caption}':
  fontsize={font_size_cap}:
  fontcolor={cap_text}:
  x=(w-text_w)/2:
  y={h - 80}:
  font=Arial-Bold:
  box=1:
  boxcolor={cap_bg}@0.85:
  boxborderw=20[output]
"""
    return filter_complex.strip()


def edit_video(
    input_video: str,
    output_video: str,
    texts: dict,
    config: dict = None,
    mode: str = "split"
):
    """
    Edita un video aplicando el estilo
    
    Args:
        input_video: Ruta al video de entrada
        output_video: Ruta del video de salida
        texts: {
            "title": "Texto principal en naranja",
            "subtitle": "Texto secundario en negro",  
            "caption": "CAPTION EN LA PARTE INFERIOR",
            "label_top": "ETIQUETA PEQUEÑA ARRIBA"
        }
        config: Configuración de colores y layout (usa DEFAULT_CONFIG si None)
        mode: "split" o "fullscreen"
    """
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    cfg["mode"] = mode
    
    if mode == "split":
        vf = build_split_screen_filter(cfg, texts)
    else:
        vf = build_fullscreen_filter(cfg, texts)
    
    cmd = [
        "ffmpeg", "-i", input_video,
        "-filter_complex", vf,
        "-map", "[output]",
        "-map", "0:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        "-y", output_video
    ]
    
    print(f"🎬 Editando video en modo: {mode}")
    print(f"📝 Título: {texts.get('title', '')}")
    print(f"🎨 Color acento: {cfg['accent_color']}")
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        size = os.path.getsize(output_video) / 1024 / 1024
        print(f"✅ Video generado: {output_video} ({size:.1f} MB)")
        return True
    else:
        print(f"❌ Error: {result.stderr[-500:]}")
        return False


def batch_edit(input_video: str, slides: list, output_dir: str, config: dict = None):
    """
    Genera múltiples variantes del video con diferentes textos
    slides: lista de dicts con texts por segmento
    """
    os.makedirs(output_dir, exist_ok=True)
    results = []
    
    for i, slide in enumerate(slides):
        out = os.path.join(output_dir, f"slide_{i+1:02d}.mp4")
        mode = slide.get("mode", "split")
        texts = slide.get("texts", {})
        success = edit_video(input_video, out, texts, config, mode)
        results.append({"slide": i+1, "output": out, "success": success})
    
    return results


# ─── EJEMPLOS DE USO ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Editor de video estilo split-screen")
    parser.add_argument("input", help="Video de entrada")
    parser.add_argument("output", help="Video de salida")
    parser.add_argument("--mode", choices=["split", "fullscreen"], default="split")
    parser.add_argument("--title", default="una sola cosa", help="Texto principal (naranja)")
    parser.add_argument("--subtitle", default="Enseñando", help="Texto secundario (negro)")
    parser.add_argument("--caption", default="CAPTION INFERIOR", help="Caption inferior")
    parser.add_argument("--label", default="VENDE DIEZ CURSOS DISTINTOS", help="Etiqueta top")
    parser.add_argument("--accent", default="#E85D26", help="Color acento (hex)")
    parser.add_argument("--bg", default="#F5F0EB", help="Color fondo (hex)")
    parser.add_argument("--config", help="JSON con config completa")
    
    args = parser.parse_args()
    
    config = None
    if args.config:
        with open(args.config) as f:
            config = json.load(f)
    else:
        config = {
            "accent_color": args.accent,
            "bg_color": args.bg,
        }
    
    texts = {
        "title": args.title,
        "subtitle": args.subtitle,
        "caption": args.caption,
        "label_top": args.label,
    }
    
    edit_video(args.input, args.output, texts, config, args.mode)
