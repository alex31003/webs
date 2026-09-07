#!/usr/bin/env python3
"""
PRODUCE_PRO.PY — Editor ultra-profesional con jump cuts automáticos
- Elimina silencios automáticamente (jump cuts limpios)
- Zoom dinámico en cortes para evitar monotonía visual
- Color grade profesional (eq + curves + unsharp + vignette)
- Motion graphics: intro animado, b-roll cards, lower third, outro
- Audio normalizado (loudnorm EBU R128)
- B-roll cada ~15s de contenido real
- Estructura narrativa: Hook → Desarrollo → Clímax → Cierre
"""

import subprocess, os, json, argparse, re

P = {
    "green":   "0x4ADE80",
    "mustard": "0xD4A017",
    "dark":    "0x0A1A10",
    "white":   "white",
    "gray":    "0x9CA3AF",
    "black":   "black",
    "font":    "Arial-Bold",
    "mono":    "Courier",
    "W": 576, "H": 1024,
}

def run(cmd, label=""):
    r = subprocess.run(cmd, capture_output=True, text=True)
    ok = r.returncode == 0
    print(("✅" if ok else "❌") + f" {label}")
    if not ok:
        print(r.stderr[-300:])
    return ok

def esc(s):
    return str(s).replace("'","").replace(":","\\:").replace(",","\\,").replace("[","").replace("]","")

def even(n):
    return n if n % 2 == 0 else n - 1


# ══════════════════════════════════════════════════════════════════════════════
# PASO 1: Detectar silencios y construir segmentos de habla
# ══════════════════════════════════════════════════════════════════════════════
def detect_speech_segments(video, min_silence=0.4, threshold=-25):
    """
    Detecta silencios y devuelve lista de (start, end) de segmentos con habla.
    Solo corta silencios > min_silence segundos.
    """
    r = subprocess.run([
        "ffmpeg", "-i", video,
        "-af", f"silencedetect=noise={threshold}dB:d={min_silence}",
        "-f", "null", "-"
    ], capture_output=True, text=True)

    silences = []
    for line in r.stderr.split('\n'):
        ms = re.search(r'silence_start: ([0-9.]+)', line)
        me = re.search(r'silence_end: ([0-9.]+)', line)
        if ms:
            silences.append([float(ms.group(1)), None])
        if me and silences:
            silences[-1][1] = float(me.group(1))

    # Get total duration
    rd = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", video],
        capture_output=True, text=True
    )
    total = float(rd.stdout.strip())

    # Build speech segments (between silences)
    segs = []
    prev = 0.0
    for s_start, s_end in silences:
        if s_end is None:
            s_end = total
        if s_start > prev + 0.1:
            segs.append((round(prev, 3), round(s_start, 3)))
        prev = s_end

    if prev < total - 0.2:
        segs.append((round(prev, 3), round(total, 3)))

    return segs, total


# ══════════════════════════════════════════════════════════════════════════════
# PASO 2: Extraer y procesar cada segmento de habla
# ══════════════════════════════════════════════════════════════════════════════
def extract_segment(video, start, end, out, zoom=1.0):
    """
    Extrae un segmento y aplica:
    - Color grade profesional (curvas S, saturation, unsharp, vignette)
    - Zoom sutil (scale 1.0x a 1.08x, centrado)
    - Escala a 576x1024
    """
    W, H = P["W"], P["H"]
    dur = end - start

    # Zoom: escalar un poco más y crop al centro
    scale_w = int(W * zoom)
    scale_h = int(H * zoom)
    scale_w = scale_w + (scale_w % 2)
    scale_h = scale_h + (scale_h % 2)

    vf = (
        f"scale={scale_w}:{scale_h}:force_original_aspect_ratio=increase,"
        f"crop={W}:{H},"
        # Color grade: contraste + calidez de piel + saturación
        f"eq=contrast=1.09:brightness=0.015:saturation=1.18:gamma_r=1.04:gamma_b=0.96,"
        # Curva S suave
        f"curves=r='0/0 0.35/0.32 0.7/0.72 1/1':g='0/0 0.35/0.35 0.7/0.73 1/1':b='0/0 0.35/0.30 0.7/0.68 1/1',"
        # Sharpness
        f"unsharp=5:5:0.5:3:3:0,"
        # Viñeta
        f"vignette=PI/4.5"
    )

    return run([
        "ffmpeg", "-ss", str(start), "-i", video, "-t", str(dur),
        "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        # Normalizar audio EBU R128
        "-af", "loudnorm=I=-16:LRA=11:TP=-1.5",
        "-c:v", "libx264", "-preset", "fast", "-crf", "17",
        "-c:a", "aac", "-b:a", "192k", "-y", out
    ], f"Seg {start:.1f}s-{end:.1f}s → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# MOTION GRAPHICS (ffmpeg puro — ultra-rápido, sin dependencias externas)
# ══════════════════════════════════════════════════════════════════════════════

def mg_intro(out, name="ALEX VERA", tagline="Emprendedor Digital", dur=3.0):
    """Intro oscuro animado con barra, nombre y tagline."""
    W, H = P["W"], P["H"]
    n, t = esc(name), esc(tagline)
    vf = (
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['mustard']}:t=fill,"
        f"drawbox=x=0:y={H-8}:w={W}:h=8:color={P['mustard']}:t=fill,"
        f"drawbox=x=0:y={H//2-5}:w={W}:h=3:color={P['mustard']}@0.35:t=fill:enable='gte(t,0.25)',"
        f"drawtext=text='{n}':fontsize=78:fontcolor={P['white']}"
        f":x=(w-text_w)/2:y={H//2-100}:font={P['font']}"
        f":shadowcolor={P['green']}@0.5:shadowx=3:shadowy=3:enable='gte(t,0.4)',"
        f"drawtext=text='{t}':fontsize=30:fontcolor={P['green']}"
        f":x=(w-text_w)/2:y={H//2+30}:font={P['font']}:enable='gte(t,1.0)',"
        f"drawbox=x=(w-480)/2:y={H//2-10}:w=480:h=4"
        f":color={P['mustard']}:t=fill:enable='gte(t,0.8)'"
    )
    return run([
        "ffmpeg", "-f", "lavfi",
        "-i", f"color={P['dark']}:size={W}x{H}:duration={dur}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-y", out
    ], f"Intro MG → {os.path.basename(out)}")


def mg_kinetic(out, lines, dur=4.0, accent=0):
    """Texto cinético: líneas aparecen escalonadas."""
    W, H = P["W"], P["H"]
    n = len(lines)
    cy = H // 2 - (n * 72) // 2
    vf = (
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['mustard']}:t=fill,"
        f"drawbox=x=0:y=0:w=8:h={H}:color={P['mustard']}@0.45:t=fill"
    )
    for i, line in enumerate(lines[:6]):
        color = P["green"] if i == accent else P["white"]
        size = 62 if i == accent else 42
        y = cy + i * 76
        delay = 0.25 + i * 0.30
        vf += (
            f",drawtext=text='{esc(line)}':fontsize={size}:fontcolor={color}"
            f":x=(w-text_w)/2:y={y}:font={P['font']}"
            f":shadowcolor=black@0.8:shadowx=2:shadowy=2:enable='gte(t,{delay})'"
        )
    return run([
        "ffmpeg", "-f", "lavfi",
        "-i", f"color={P['dark']}:size={W}x{H}:duration={dur}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-y", out
    ], f"Kinetic '{lines[0]}' → {os.path.basename(out)}")


def mg_stat(out, number, label, sub="", dur=3.5):
    """Tarjeta de estadística con número grande."""
    W, H = P["W"], P["H"]
    num, lbl, s = esc(number), esc(label), esc(sub)
    vf = (
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['mustard']}:t=fill,"
        f"drawbox=x=55:y={H//2-170}:w={W-110}:h=340"
        f":color={P['mustard']}@0.07:t=fill,"
        f"drawbox=x=55:y={H//2-170}:w={W-110}:h=340"
        f":color={P['mustard']}@0.5:t=3,"
        f"drawtext=text='{num}':fontsize=130:fontcolor={P['green']}"
        f":x=(w-text_w)/2:y={H//2-155}:font={P['font']}"
        f":shadowcolor={P['green']}@0.3:shadowx=4:shadowy=4:enable='gte(t,0.3)',"
        f"drawtext=text='{lbl}':fontsize=36:fontcolor={P['mustard']}"
        f":x=(w-text_w)/2:y={H//2+35}:font={P['font']}:enable='gte(t,0.7)'"
        + (f",drawtext=text='{s}':fontsize=26:fontcolor={P['gray']}"
           f":x=(w-text_w)/2:y={H//2+85}:font={P['font']}:enable='gte(t,1.0)'" if sub else "")
    )
    return run([
        "ffmpeg", "-f", "lavfi",
        "-i", f"color={P['dark']}:size={W}x{H}:duration={dur}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-y", out
    ], f"Stat '{number}' → {os.path.basename(out)}")


def mg_list(out, title, items, dur=5.0):
    """Lista animada con checkmarks verdes."""
    W, H = P["W"], P["H"]
    vf = (
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['mustard']}:t=fill,"
        f"drawbox=x=0:y=0:w=8:h={H}:color={P['green']}@0.55:t=fill,"
        f"drawtext=text='{esc(title)}':fontsize=46:fontcolor={P['mustard']}"
        f":x=(w-text_w)/2:y=105:font={P['font']}:enable='gte(t,0.2)'"
    )
    for i, item in enumerate(items[:6]):
        y = 230 + i * 85
        d = 0.5 + i * 0.45
        vf += (
            f",drawtext=text='✓':fontsize=38:fontcolor={P['green']}"
            f":x=48:y={y}:font={P['font']}:enable='gte(t,{d})'"
            f",drawtext=text='{esc(item)}':fontsize=33:fontcolor={P['white']}"
            f":x=98:y={y+2}:font={P['font']}:enable='gte(t,{d})'"
        )
    return run([
        "ffmpeg", "-f", "lavfi",
        "-i", f"color={P['dark']}:size={W}x{H}:duration={dur}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-y", out
    ], f"Lista '{title}' → {os.path.basename(out)}")


def mg_quote(out, quote, author="", dur=4.0):
    """Tarjeta de cita/frase impactante."""
    W, H = P["W"], P["H"]
    # Wrap quote manually (max ~22 chars per line)
    words = esc(quote).split()
    lines = []
    cur = ""
    for w in words:
        if len(cur) + len(w) + 1 > 22:
            if cur:
                lines.append(cur.strip())
            cur = w + " "
        else:
            cur += w + " "
    if cur.strip():
        lines.append(cur.strip())

    cy = H // 2 - len(lines) * 30
    vf = (
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['mustard']}:t=fill,"
        f"drawbox=x={W//2-2}:y=0:w=4:h={H}:color={P['mustard']}@0.15:t=fill,"
        f"drawtext=text='\"':fontsize=140:fontcolor={P['mustard']}@0.25"
        f":x=20:y=60:font={P['font']}"
    )
    for i, line in enumerate(lines[:5]):
        y = cy + i * 68
        vf += (
            f",drawtext=text='{line}':fontsize=44:fontcolor={P['white']}"
            f":x=(w-text_w)/2:y={y}:font={P['font']}"
            f":shadowcolor=black@0.8:shadowx=2:shadowy=2:enable='gte(t,{0.3+i*0.2})'"
        )
    if author:
        vf += (
            f",drawtext=text='— {esc(author)}':fontsize=28:fontcolor={P['green']}"
            f":x=(w-text_w)/2:y={cy+len(lines)*70+20}:font={P['font']}:enable='gte(t,1.2)'"
        )
    return run([
        "ffmpeg", "-f", "lavfi",
        "-i", f"color={P['dark']}:size={W}x{H}:duration={dur}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-y", out
    ], f"Quote MG → {os.path.basename(out)}")


def mg_outro(out, cta="Sígueme para más", username="@tu_usuario", dur=4.0):
    """Outro con CTA animado."""
    W, H = P["W"], P["H"]
    c, u = esc(cta), esc(username)
    mid = H // 2
    vf = (
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['mustard']}:t=fill,"
        f"drawbox=x=0:y={H-8}:w={W}:h=8:color={P['mustard']}:t=fill,"
        f"drawtext=text='{c}':fontsize=40:fontcolor={P['white']}"
        f":x=(w-text_w)/2:y={mid-130}:font={P['font']}:enable='gte(t,0.4)',"
        f"drawbox=x=55:y={mid-30}:w={W-110}:h=88"
        f":color={P['mustard']}@0.12:t=fill:enable='gte(t,0.8)',"
        f"drawbox=x=55:y={mid-30}:w={W-110}:h=88"
        f":color={P['mustard']}@0.65:t=2:enable='gte(t,0.8)',"
        f"drawtext=text='{u}':fontsize=54:fontcolor={P['green']}"
        f":x=(w-text_w)/2:y={mid+5}:font={P['font']}"
        f":shadowcolor={P['green']}@0.35:shadowx=3:shadowy=3:enable='gte(t,1.0)'"
    )
    return run([
        "ffmpeg", "-f", "lavfi",
        "-i", f"color={P['dark']}:size={W}x{H}:duration={dur}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-y", out
    ], f"Outro → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# SPLIT SCREEN: b-roll (arriba 52%) + speaker (abajo 48%)
# ══════════════════════════════════════════════════════════════════════════════
def split_broll_speaker(broll, speaker_seg, out, caption="", watermark="@tu_usuario"):
    W, H = P["W"], P["H"]
    SY = even(int(H * 0.52))
    SH = even(H - SY)
    cap, wm = esc(caption), esc(watermark)
    fc = (
        f"[0:v]scale={W}:{SY}:force_original_aspect_ratio=increase,crop={W}:{SY}[br];"
        f"[1:v]scale={W}:{SH}:force_original_aspect_ratio=increase,crop={W}:{SH},"
        f"eq=contrast=1.05:saturation=1.1[spk];"
        f"[br][spk]vstack=inputs=2,"
        f"drawbox=x=0:y=0:w={W}:h=7:color={P['mustard']}:t=fill,"
        f"drawbox=x=0:y={SY}:w={W}:h=5:color={P['mustard']}:t=fill"
        + (f",drawtext=text='{cap}':fontsize=34:fontcolor={P['mustard']}"
           f":x=(w-text_w)/2:y={SY+16}:font={P['font']}"
           f":shadowcolor=black:shadowx=2:shadowy=2:enable='gte(t,0.15)'" if cap else "")
        + f",drawtext=text='{wm}':fontsize=19:fontcolor=white@0.72"
          f":x=w-text_w-14:y=h-40:font={P['font']}[out]"
    )
    return run([
        "ffmpeg", "-i", broll, "-i", speaker_seg,
        "-filter_complex", fc,
        "-map", "[out]", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "17",
        "-c:a", "aac", "-b:a", "192k", "-y", out
    ], f"Split → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# LOWER THIRD
# ══════════════════════════════════════════════════════════════════════════════
def add_lower_third(inp, out, name, title, show_until=5.0):
    W, H = P["W"], P["H"]
    n, t = esc(name), esc(title)
    lt_y = H - 270
    vf = (
        f"drawbox=x=0:y={lt_y}:w=430:h=96:color={P['dark']}@0.88:t=fill"
        f":enable='between(t,0.5,{show_until})',"
        f"drawbox=x=0:y={lt_y}:w=6:h=96:color={P['mustard']}:t=fill"
        f":enable='between(t,0.5,{show_until})',"
        f"drawtext=text='{n}':fontsize=38:fontcolor={P['white']}"
        f":x=18:y={lt_y+14}:font={P['font']}"
        f":enable='between(t,0.7,{show_until})',"
        f"drawtext=text='{t}':fontsize=24:fontcolor={P['green']}"
        f":x=18:y={lt_y+58}:font={P['font']}"
        f":enable='between(t,0.9,{show_until})'"
    )
    return run([
        "ffmpeg", "-i", inp, "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "17",
        "-c:a", "aac", "-b:a", "192k", "-y", out
    ], f"Lower third → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# TEXTO EN PANTALLA (key phrases)
# ══════════════════════════════════════════════════════════════════════════════
def add_screen_text(inp, out, texts, watermark="@tu_usuario"):
    """texts = [{"text":"...", "start":1.0, "end":3.0, "color":"mustard|green|white"}]"""
    W, H = P["W"], P["H"]
    wm = esc(watermark)
    vf = f"drawbox=x=0:y=0:w={W}:h=7:color={P['mustard']}:t=fill"
    for t in texts:
        color = {"mustard": P["mustard"], "green": P["green"]}.get(t.get("color"), "white")
        txt = esc(t["text"])
        ts, te = t["start"], t["end"]
        vf += (
            f",drawtext=text='{txt}':fontsize=42:fontcolor={color}"
            f":x=(w-text_w)/2:y={H-200}:font={P['font']}"
            f":shadowcolor=black@0.95:shadowx=2:shadowy=2"
            f":box=1:boxcolor=black@0.5:boxborderw=14"
            f":enable='between(t,{ts},{te})'"
        )
    vf += (
        f",drawtext=text='{wm}':fontsize=19:fontcolor=white@0.72"
        f":x=w-text_w-14:y=h-40:font={P['font']}"
    )
    return run([
        "ffmpeg", "-i", inp, "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "17",
        "-c:a", "aac", "-b:a", "192k", "-y", out
    ], f"Screen text → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# CONCAT (con audio homogéneo)
# ══════════════════════════════════════════════════════════════════════════════
def ensure_audio(clip):
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a:0",
         "-show_entries", "stream=codec_type", "-of", "csv=p=0", clip],
        capture_output=True, text=True
    )
    if "audio" in r.stdout:
        return clip
    out = clip.replace(".mp4", "_a.mp4")
    run([
        "ffmpeg", "-i", clip,
        "-f", "lavfi", "-i", "aevalsrc=0:c=stereo:r=44100",
        "-shortest", "-map", "0:v", "-map", "1:a",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-y", out
    ], f"Add silent audio → {os.path.basename(clip)}")
    return out if os.path.exists(out) else clip


def concat(clips, out):
    fixed = [ensure_audio(c) for c in clips if os.path.exists(c)]
    lst = out + ".txt"
    with open(lst, "w") as f:
        for v in fixed:
            f.write(f"file '{os.path.abspath(v)}'\n")
    ok = run([
        "ffmpeg", "-f", "concat", "-safe", "0", "-i", lst,
        "-c", "copy", "-y", out
    ], f"Concat final → {os.path.basename(out)}")
    os.remove(lst)
    return ok


# ══════════════════════════════════════════════════════════════════════════════
# PIPELINE PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════
def produce(video, out_dir, cfg):
    os.makedirs(out_dir, exist_ok=True)
    clips = []

    name     = cfg.get("name", "Alex Vera")
    tagline  = cfg.get("tagline", "Emprendedor Digital")
    username = cfg.get("username", "@alexvera")
    cta      = cfg.get("cta", "Sígueme para más tips")
    brolls   = cfg.get("brolls", [])
    key_texts = cfg.get("key_texts", [])  # textos en pantalla para el hook

    print(f"\n{'='*55}")
    print(f"  PRODUCIENDO: {cfg.get('topic','Video')}")
    print(f"{'='*55}\n")

    # ① Detectar segmentos de habla (jump cuts automáticos)
    print("🔍 Analizando silencios...")
    segs, total = detect_speech_segments(video, min_silence=0.42, threshold=-25)
    print(f"   {len(segs)} segmentos de habla detectados (de {total:.1f}s originales)")

    speech_dur = sum(e - s for s, e in segs)
    print(f"   Duración con jump cuts: {speech_dur:.1f}s (eliminados {total-speech_dur:.1f}s de silencio)\n")

    # ② Intro motion graphic
    intro_f = f"{out_dir}/00_intro.mp4"
    mg_intro(intro_f, name, tagline, dur=3.0)
    clips.append(intro_f)

    # ③ Zoom pattern para los segmentos (alternado para dinamismo)
    zoom_pattern = [1.0, 1.06, 1.0, 1.05, 1.0, 1.07, 1.0, 1.05]

    # ④ Determinar dónde insertar b-rolls (cada ~14s de habla acumulada)
    # Mapear: índice de segmento → b-roll a insertar ANTES de él
    broll_at = {}  # seg_idx → broll_cfg
    if brolls:
        acum = 0.0
        interval = speech_dur / (len(brolls) + 1)
        br_idx = 0
        for i, (s, e) in enumerate(segs):
            acum += (e - s)
            if br_idx < len(brolls) and acum >= interval * (br_idx + 1):
                broll_at[i] = brolls[br_idx]
                br_idx += 1

    # ⑤ Extraer segmentos + intercalar b-rolls
    extracted = []
    br_counter = 0

    for seg_i, (s, e) in enumerate(segs):
        # Insertar b-roll antes de este segmento?
        if seg_i in broll_at:
            br_cfg = broll_at[seg_i]
            br_type = br_cfg.get("type", "kinetic")
            br_dur = br_cfg.get("duration", 4.0)
            br_f = f"{out_dir}/broll_{br_counter:02d}.mp4"

            if br_type == "kinetic":
                mg_kinetic(br_f, br_cfg.get("lines", ["."]), br_dur, br_cfg.get("accent", 0))
            elif br_type == "stat":
                mg_stat(br_f, br_cfg.get("number",""), br_cfg.get("label",""), br_cfg.get("sub",""), br_dur)
            elif br_type == "list":
                mg_list(br_f, br_cfg.get("title",""), br_cfg.get("items",[]), br_dur)
            elif br_type == "quote":
                mg_quote(br_f, br_cfg.get("quote",""), br_cfg.get("author",""), br_dur)

            # Combinar broll + speaker en split screen si el segmento es largo
            seg_dur = e - s
            if seg_dur >= br_dur and os.path.exists(br_f):
                spk_seg = f"{out_dir}/spk_tmp_{seg_i:03d}.mp4"
                extract_segment(video, s, min(e, s + br_dur), spk_seg,
                                zoom=zoom_pattern[seg_i % len(zoom_pattern)])
                split_f = f"{out_dir}/split_{br_counter:02d}.mp4"
                caption = br_cfg.get("caption", "")
                split_broll_speaker(br_f, spk_seg, split_f, caption, username)
                clips.append(split_f)
                # Resto del segmento (después del split)
                if e > s + br_dur + 0.3:
                    rest_f = f"{out_dir}/seg_{seg_i:03d}.mp4"
                    extract_segment(video, s + br_dur, e, rest_f,
                                    zoom=zoom_pattern[(seg_i+1) % len(zoom_pattern)])
                    extracted.append(rest_f)
            else:
                clips.append(br_f)
                seg_f = f"{out_dir}/seg_{seg_i:03d}.mp4"
                extract_segment(video, s, e, seg_f, zoom=zoom_pattern[seg_i % len(zoom_pattern)])
                extracted.append(seg_f)

            br_counter += 1
        else:
            seg_f = f"{out_dir}/seg_{seg_i:03d}.mp4"
            extract_segment(video, s, e, seg_f, zoom=zoom_pattern[seg_i % len(zoom_pattern)])
            extracted.append(seg_f)

    # ⑥ Procesar el primer segmento (hook) con lower third
    if extracted:
        first = extracted[0]
        hook_f = f"{out_dir}/hook_lt.mp4"
        # Lower third en los primeros 4.5s del hook
        seg_dur_check = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", first],
            capture_output=True, text=True
        )
        seg_dur = float(seg_dur_check.stdout.strip()) if seg_dur_check.stdout.strip() else 5.0
        add_lower_third(first, hook_f, name, tagline, show_until=min(seg_dur - 0.3, 4.5))

        # Texto en pantalla sobre el hook si hay
        if key_texts:
            hook_txt = f"{out_dir}/hook_txt.mp4"
            add_screen_text(hook_f, hook_txt, key_texts, username)
            clips.insert(1, hook_txt)  # después del intro
            extracted[0] = None  # ya procesado
        else:
            clips.insert(1, hook_f)
            extracted[0] = None

    # Agregar segmentos extraídos restantes
    for seg_f in extracted:
        if seg_f and os.path.exists(seg_f):
            clips.append(seg_f)

    # ⑦ Outro
    outro_f = f"{out_dir}/99_outro.mp4"
    mg_outro(outro_f, cta, username, dur=4.0)
    clips.append(outro_f)

    # ⑧ Concat final
    final = f"{out_dir}/FINAL_{name.replace(' ','_')}.mp4"
    concat(clips, final)

    if os.path.exists(final):
        sz = os.path.getsize(final) / 1024 / 1024
        # Get duration
        rd = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", final],
            capture_output=True, text=True
        )
        dur_final = float(rd.stdout.strip()) if rd.stdout.strip() else 0
        print(f"\n🎬 FINAL: {final}")
        print(f"   {sz:.1f} MB  |  {dur_final:.1f}s  |  576×1024")
        print(f"   Clips ensamblados: {len([c for c in clips if os.path.exists(c)])}")
    return final


# ── CLI ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Editor profesional con jump cuts automáticos")
    p.add_argument("video", help="Video del speaker")
    p.add_argument("-o", "--output-dir", default="./produccion_pro")
    p.add_argument("--config", help="JSON de configuración")
    p.add_argument("--name", default="Alex Vera")
    p.add_argument("--tagline", default="Emprendedor Digital")
    p.add_argument("--username", default="@alexvera")
    p.add_argument("--topic", default="Mi video")
    p.add_argument("--cta", default="Sigueme para mas tips")
    args = p.parse_args()

    if args.config:
        with open(args.config) as f:
            cfg = json.load(f)
    else:
        cfg = {
            "name": args.name,
            "tagline": args.tagline,
            "username": args.username,
            "topic": args.topic,
            "cta": args.cta,
            # ── Textos clave sobre el HOOK (primeros segundos) ──────────────
            "key_texts": [
                {"text": "esto te va a cambiar", "start": 0.5, "end": 2.5, "color": "mustard"},
            ],
            # ── B-rolls intercalados (distribuidos automáticamente) ──────────
            "brolls": [
                {
                    "type": "kinetic",
                    "lines": ["La mayoria", "de emprendedores", "comete este error"],
                    "accent": 2,
                    "duration": 4.0,
                    "caption": "escucha esto"
                },
                {
                    "type": "stat",
                    "number": "92%",
                    "label": "no saben vender",
                    "sub": "aunque tengan el mejor producto",
                    "duration": 3.5,
                    "caption": "los datos no mienten"
                },
                {
                    "type": "list",
                    "title": "Lo que SI funciona:",
                    "items": [
                        "Conocer tu cliente ideal",
                        "Propuesta de valor clara",
                        "Consistencia en contenido",
                        "Seguimiento real",
                    ],
                    "duration": 5.0,
                    "caption": "guardalo"
                },
                {
                    "type": "quote",
                    "quote": "Vender es servir, no convencer",
                    "author": "Alex Vera",
                    "duration": 3.5,
                    "caption": ""
                },
                {
                    "type": "kinetic",
                    "lines": ["Aplica esto", "HOY", "y ve los resultados"],
                    "accent": 1,
                    "duration": 3.5,
                    "caption": "sin excusas"
                },
            ]
        }

    produce(args.video, args.output_dir, cfg)
