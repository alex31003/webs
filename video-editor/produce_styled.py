#!/usr/bin/env python3
"""
PRODUCE_STYLED.PY — Combina estilo V1 + V2
  V1: text cards oscuros, conceptos numerados, acento naranja/mostaza
  V2: color grade moody/oscuro, split screen, captions blancas en negrita
  - Jump cuts automáticos (silencedetect)
  - Sound effects sintetizados con ffmpeg
  - B-roll = text cards numerados estilo V1
  - Split screen: card top + speaker bottom
  - Sin presentaciones de nombre
"""

import subprocess, os, re, sys

UPLOADS = "/root/.claude/uploads/c1f4d553-3f41-52af-aff5-9f0914e9bea6"
V3      = f"{UPLOADS}/737315a1-parte_1.mp4"
SCRATCH = "/tmp/claude-0/-home-user-webs/c1f4d553-3f41-52af-aff5-9f0914e9bea6/scratchpad/styled"
os.makedirs(SCRATCH, exist_ok=True)

P = {
    "orange":  "0xF97316",
    "dark":    "0x0D1117",
    "dark2":   "0x161B22",
    "white":   "white",
    "gray":    "0x8B949E",
    "accent":  "0xD4A017",
    "W": 576, "H": 1024,
}

def run(cmd, label=""):
    r = subprocess.run(cmd, capture_output=True, text=True)
    ok = r.returncode == 0
    print(("✅" if ok else "❌") + f" {label}")
    if not ok:
        print(r.stderr[-400:])
    return ok

def esc(s):
    return str(s).replace("'","").replace(":","\\:").replace(",","\\,").replace("[","").replace("]","")

def p(name):
    return os.path.join(SCRATCH, name)


# ─────────────────────────────────────────────────────────────
# PASO 1: Detectar habla (jump cuts)
# ─────────────────────────────────────────────────────────────
def detect_speech(video, silence_db=-28, min_silence=0.40):
    r = subprocess.run([
        "ffmpeg", "-i", video,
        "-af", f"silencedetect=noise={silence_db}dB:d={min_silence}",
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

    rd = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", video], capture_output=True, text=True)
    total = float(rd.stdout.strip())

    segs = []
    prev = 0.0
    for ss, se in silences:
        if se is None:
            se = total
        if ss > prev + 0.15:
            segs.append((round(prev, 3), round(ss, 3)))
        prev = se
    if prev < total - 0.2:
        segs.append((round(prev, 3), round(total, 3)))

    return segs, total


# ─────────────────────────────────────────────────────────────
# PASO 2: Extraer segmento — color grade moody estilo V2
# ─────────────────────────────────────────────────────────────
def extract_seg(video, start, end, out, zoom=1.0):
    W, H = P["W"], P["H"]
    dur = end - start
    sw = int(W * zoom); sh = int(H * zoom)
    sw += sw % 2; sh += sh % 2

    # V2-style: oscuro, alto contraste, leve tinte azul, viñeta fuerte
    vf = (
        f"scale={sw}:{sh}:force_original_aspect_ratio=increase,"
        f"crop={W}:{H},"
        f"eq=contrast=1.18:brightness=-0.04:saturation=0.88:gamma_r=0.96:gamma_b=1.07,"
        f"curves=r='0/0 0.3/0.25 0.7/0.68 1/0.96':g='0/0 0.3/0.27 0.7/0.70 1/0.98':b='0/0 0.3/0.30 0.7/0.74 1/1',"
        f"unsharp=5:5:0.6:3:3:0,"
        f"vignette=PI/3.5"
    )
    return run([
        "ffmpeg", "-ss", str(start), "-i", video, "-t", str(dur),
        "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        "-af", "loudnorm=I=-16:LRA=11:TP=-1.5",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-y", out
    ], f"Seg {start:.1f}s-{end:.1f}s → {os.path.basename(out)}")


# ─────────────────────────────────────────────────────────────
# PASO 3: B-roll cards estilo V1 — fondo oscuro, texto numerado
# ─────────────────────────────────────────────────────────────
def broll_numbered(out, number, headline, sub="", dur=3.5):
    """Text card: número grande naranja + titular blanco + subtítulo gris"""
    W, H = P["W"], P["H"]
    n, h, s = esc(str(number)), esc(headline), esc(sub)
    vf = (
        # Fondo oscuro con línea izquierda naranja
        f"drawbox=x=0:y=0:w={W}:h={H}:color={P['dark']}:t=fill,"
        f"drawbox=x=0:y=0:w=6:h={H}:color={P['orange']}:t=fill,"
        # Línea horizontal sutil
        f"drawbox=x=40:y={H//2-80}:w={W-80}:h=2:color={P['orange']}@0.3:t=fill:enable='gte(t,0.1)',"
        f"drawbox=x=40:y={H//2+50}:w={W-80}:h=2:color={P['orange']}@0.3:t=fill:enable='gte(t,0.15)',"
        # Número grande
        f"drawtext=text='{n}':fontsize=160:fontcolor={P['orange']}@0.15"
        f":x=(w-text_w)/2:y={H//2-230}:font=Arial-Bold:enable='gte(t,0)',"
        # Titular
        f"drawtext=text='{h}':fontsize=56:fontcolor={P['white']}"
        f":x=(w-text_w)/2:y={H//2-60}:font=Arial-Bold"
        f":shadowcolor=black@0.7:shadowx=2:shadowy=2:enable='gte(t,0.2)'"
    )
    if sub:
        vf += (
            f",drawtext=text='{s}':fontsize=32:fontcolor={P['gray']}"
            f":x=(w-text_w)/2:y={H//2+65}:font=Arial"
            f":enable='gte(t,0.4)'"
        )
    return run([
        "ffmpeg", "-f", "lavfi",
        "-i", f"color={P['dark']}:size={W}x{H}:duration={dur}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-y", out
    ], f"Card #{n} '{headline}' → {os.path.basename(out)}")


def broll_quote(out, quote, dur=4.0):
    """Quote card: comillas grandes + texto centrado"""
    W, H = P["W"], P["H"]
    q = esc(quote)
    # Split en líneas si es largo
    words = quote.split()
    mid = len(words) // 2
    line1 = esc(" ".join(words[:mid]))
    line2 = esc(" ".join(words[mid:]))
    vf = (
        f"drawbox=x=0:y=0:w={W}:h={H}:color={P['dark2']}:t=fill,"
        f"drawbox=x={W//2-2}:y=0:w=4:h={H}:color={P['orange']}@0.15:t=fill,"
        f"drawtext=text='\\\"':fontsize=180:fontcolor={P['orange']}@0.2"
        f":x=30:y={H//2-200}:font=Arial-Bold,"
        f"drawtext=text='{line1}':fontsize=48:fontcolor={P['white']}"
        f":x=(w-text_w)/2:y={H//2-70}:font=Arial-Bold"
        f":shadowcolor=black@0.8:shadowx=2:shadowy=2:enable='gte(t,0.3)',"
        f"drawtext=text='{line2}':fontsize=48:fontcolor={P['white']}"
        f":x=(w-text_w)/2:y={H//2+0}:font=Arial-Bold"
        f":shadowcolor=black@0.8:shadowx=2:shadowy=2:enable='gte(t,0.5)',"
        f"drawbox=x=60:y={H//2+70}:w={W-120}:h=3:color={P['orange']}:t=fill:enable='gte(t,0.7)'"
    )
    return run([
        "ffmpeg", "-f", "lavfi",
        "-i", f"color={P['dark2']}:size={W}x{H}:duration={dur}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-y", out
    ], f"Quote → {os.path.basename(out)}")


def broll_stat(out, number, label, dur=3.5):
    """Stat: número enorme + etiqueta"""
    W, H = P["W"], P["H"]
    n, l = esc(str(number)), esc(label)
    vf = (
        f"drawbox=x=0:y=0:w={W}:h={H}:color={P['dark']}:t=fill,"
        f"drawbox=x=0:y={H//2-8}:w={W}:h=4:color={P['orange']}@0.2:t=fill,"
        f"drawtext=text='{n}':fontsize=180:fontcolor={P['orange']}"
        f":x=(w-text_w)/2:y={H//2-180}:font=Arial-Bold"
        f":shadowcolor={P['orange']}@0.3:shadowx=0:shadowy=0:enable='gte(t,0.2)',"
        f"drawtext=text='{l}':fontsize=42:fontcolor={P['white']}"
        f":x=(w-text_w)/2:y={H//2+30}:font=Arial-Bold:enable='gte(t,0.5)'"
    )
    return run([
        "ffmpeg", "-f", "lavfi",
        "-i", f"color={P['dark']}:size={W}x{H}:duration={dur}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-y", out
    ], f"Stat '{number}' → {os.path.basename(out)}")


def broll_list(out, title, items, dur=5.5):
    """Lista animada con checkmarks naranjas"""
    W, H = P["W"], P["H"]
    t = esc(title)
    vf = (
        f"drawbox=x=0:y=0:w={W}:h={H}:color={P['dark']}:t=fill,"
        f"drawbox=x=0:y=0:w={W}:h=6:color={P['orange']}:t=fill,"
        f"drawtext=text='{t}':fontsize=44:fontcolor={P['orange']}"
        f":x=40:y=80:font=Arial-Bold:enable='gte(t,0.1)'"
    )
    for i, item in enumerate(items[:5]):
        it = esc(item)
        y = 180 + i * 90
        delay = 0.4 + i * 0.35
        vf += (
            f",drawbox=x=40:y={y}:w=36:h=36:color={P['orange']}:t=fill:enable='gte(t,{delay})',"
            f"drawtext=text='✓':fontsize=24:fontcolor={P['dark']}"
            f":x=48:y={y+6}:font=Arial-Bold:enable='gte(t,{delay})',"
            f"drawtext=text='{it}':fontsize=38:fontcolor={P['white']}"
            f":x=100:y={y+2}:font=Arial-Bold:enable='gte(t,{delay:.2f})'"
        )
    return run([
        "ffmpeg", "-f", "lavfi",
        "-i", f"color={P['dark']}:size={W}x{H}:duration={dur}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-y", out
    ], f"Lista '{title}' → {os.path.basename(out)}")


def outro(out, handle="@alexvera", dur=4.0):
    """Outro: CTA con handle + gradiente oscuro"""
    W, H = P["W"], P["H"]
    h = esc(handle)
    vf = (
        f"drawbox=x=0:y=0:w={W}:h={H}:color={P['dark']}:t=fill,"
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['orange']}:t=fill,"
        f"drawbox=x=0:y={H-8}:w={W}:h=8:color={P['orange']}:t=fill,"
        f"drawtext=text='Sígueme':fontsize=38:fontcolor={P['gray']}"
        f":x=(w-text_w)/2:y={H//2-120}:font=Arial:enable='gte(t,0.3)',"
        f"drawtext=text='{h}':fontsize=90:fontcolor={P['white']}"
        f":x=(w-text_w)/2:y={H//2-50}:font=Arial-Bold"
        f":shadowcolor={P['orange']}@0.5:shadowx=3:shadowy=3:enable='gte(t,0.6)',"
        f"drawbox=x=100:y={H//2+60}:w={W-200}:h=5:color={P['orange']}:t=fill:enable='gte(t,0.8)',"
        f"drawtext=text='Para más contenido':fontsize=30:fontcolor={P['gray']}"
        f":x=(w-text_w)/2:y={H//2+80}:font=Arial:enable='gte(t,1.0)'"
    )
    return run([
        "ffmpeg", "-f", "lavfi",
        "-i", f"color={P['dark']}:size={W}x{H}:duration={dur}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-y", out
    ], f"Outro → {os.path.basename(out)}")


# ─────────────────────────────────────────────────────────────
# PASO 4: Split screen — card top 50% + speaker bottom 50%
# ─────────────────────────────────────────────────────────────
def split_card_speaker(card, speaker, out, dur=None):
    """card arriba (512px), speaker abajo (512px), línea naranja divisor"""
    W, H = P["W"], P["H"]
    half = H // 2

    if dur is None:
        # Usar duración del speaker
        rd = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
            "format=duration", "-of", "csv=p=0", speaker],
            capture_output=True, text=True)
        dur = float(rd.stdout.strip())

    return run([
        "ffmpeg",
        "-i", card, "-i", speaker,
        "-filter_complex",
        f"[0:v]scale={W}:{half}:force_original_aspect_ratio=increase,"
        f"crop={W}:{half}[top];"
        f"[1:v]scale={W}:{half}:force_original_aspect_ratio=increase,"
        f"crop={W}:{half}[bot];"
        f"[top][bot]vstack[base];"
        f"[base]drawbox=x=0:y={half-3}:w={W}:h=6:color={P['orange']}:t=fill[v]",
        "-map", "[v]", "-map", "1:a",
        "-t", str(dur),
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-y", out
    ], f"Split → {os.path.basename(out)}")


# ─────────────────────────────────────────────────────────────
# PASO 5: Añadir audio silencioso (para clips sin audio)
# ─────────────────────────────────────────────────────────────
def ensure_audio(clip):
    """Añade anullsrc si el clip no tiene audio."""
    check = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=codec_type", "-of", "csv=p=0", clip],
        capture_output=True, text=True)
    if check.stdout.strip():
        return clip

    tmp = clip.replace(".mp4", "_a.mp4")
    rd = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
        "format=duration", "-of", "csv=p=0", clip],
        capture_output=True, text=True)
    dur = float(rd.stdout.strip())

    run([
        "ffmpeg", "-i", clip,
        "-f", "lavfi", "-i", f"anullsrc=channel_layout=stereo:sample_rate=44100",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
        "-t", str(dur), "-shortest", "-y", tmp
    ], f"Add audio → {os.path.basename(tmp)}")
    return tmp


# ─────────────────────────────────────────────────────────────
# PASO 6: Sound effect — whoosh sintetizado + mixdown
# ─────────────────────────────────────────────────────────────
def add_whoosh(clip, out, vol=0.15):
    """Añade whoosh al inicio del clip (sintetizado con ffmpeg)"""
    rd = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
        "format=duration", "-of", "csv=p=0", clip],
        capture_output=True, text=True)
    dur = float(rd.stdout.strip())

    # Whoosh: sweep de 800Hz a 200Hz en 0.15s, fade out
    whoosh_af = (
        "sine=frequency=800:duration=0.15,"
        "afade=t=out:st=0.05:d=0.1,"
        "volume=0.12"
    )
    return run([
        "ffmpeg", "-i", clip,
        "-f", "lavfi", "-i", whoosh_af,
        "-filter_complex",
        "[0:a][1:a]amix=inputs=2:duration=first:weights=1 0.15[a]",
        "-map", "0:v", "-map", "[a]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-t", str(dur), "-y", out
    ], f"Whoosh → {os.path.basename(out)}")


# ─────────────────────────────────────────────────────────────
# PASO 7: Caption overlay estilo V2 — texto blanco negrita
# ─────────────────────────────────────────────────────────────
def add_caption(clip, out, text, start=0.5, end=None):
    """Texto en negrita blanco grande en la parte inferior del speaker"""
    W, H = P["W"], P["H"]
    rd = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
        "format=duration", "-of", "csv=p=0", clip],
        capture_output=True, text=True)
    dur = float(rd.stdout.strip())
    if end is None:
        end = dur - 0.2

    txt = esc(text)
    enable = f"between(t,{start},{end})"
    vf = (
        f"drawbox=x=0:y={H-220}:w={W}:h=100:color=black@0.55:t=fill:enable='{enable}',"
        f"drawtext=text='{txt}':fontsize=52:fontcolor={P['white']}"
        f":x=(w-text_w)/2:y={H-190}:font=Arial-Bold"
        f":shadowcolor=black@0.9:shadowx=3:shadowy=3:enable='{enable}'"
    )
    return run([
        "ffmpeg", "-i", clip,
        "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "copy", "-y", out
    ], f"Caption '{text[:20]}' → {os.path.basename(out)}")


# ─────────────────────────────────────────────────────────────
# PASO 8: Concat final
# ─────────────────────────────────────────────────────────────
def concat(clips, out):
    list_file = p("concat_list.txt")
    with open(list_file, "w") as f:
        for c in clips:
            ca = ensure_audio(c)
            f.write(f"file '{ca}'\n")

    return run([
        "ffmpeg", "-f", "concat", "-safe", "0", "-i", list_file,
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", "-y", out
    ], f"Concat final → {os.path.basename(out)}")


# ─────────────────────────────────────────────────────────────
# PRODUCCIÓN PRINCIPAL
# ─────────────────────────────────────────────────────────────
def produce():
    W, H = P["W"], P["H"]
    print(f"\n{'='*55}")
    print(f"  PRODUCIENDO ESTILO V1+V2 — Alex Vera")
    print(f"{'='*55}\n")

    # ── Detectar habla
    segs, total = detect_speech(V3)
    speech_dur = sum(e - s for s, e in segs)
    print(f"🔍 {len(segs)} segmentos de habla | {speech_dur:.1f}s de contenido (de {total:.1f}s)\n")

    # ── Extraer segmentos con color grade moody V2
    zooms = [1.0, 1.05, 1.0, 1.07, 1.0, 1.04, 1.0, 1.06]
    seg_files = []
    for i, (s, e) in enumerate(segs):
        out = p(f"seg_{i:03d}.mp4")
        extract_seg(V3, s, e, out, zoom=zooms[i % len(zooms)])
        seg_files.append(out)

    # ── Contenido b-roll (basado en tema: emprendimiento y ventas)
    brolls = [
        # (tipo, args, duración)
        ("numbered", (1, "La mayoría lo hace mal", "Pero tú puedes diferenciarte"), 3.5),
        ("stat",     ("80%", "de negocios fallan sin estrategia"), 3.5),
        ("numbered", (2, "El secreto está en el valor", "No en el precio"), 3.5),
        ("list",     ("Lo que SÍ funciona:", ["Consistencia", "Propuesta de valor", "Confianza", "Acción diaria"]), 5.5),
        ("numbered", (3, "Tu marca personal", "Es tu activo más valioso"), 3.5),
        ("quote",    ("Si no vendes, no tienes negocio", ), 4.0),
        ("numbered", (4, "Aplica esto hoy", "No mañana — HOY"), 3.5),
    ]

    # ── Generar b-roll cards
    broll_files = []
    for i, (tipo, args, dur) in enumerate(brolls):
        out = p(f"broll_{i:02d}.mp4")
        if tipo == "numbered":
            broll_numbered(out, *args, dur=dur)
        elif tipo == "stat":
            broll_stat(out, *args, dur=dur)
        elif tipo == "list":
            broll_list(out, *args, dur=dur)
        elif tipo == "quote":
            broll_quote(out, *args, dur=dur)
        broll_files.append(out)

    # ── Outro
    out_outro = p("outro.mp4")
    outro(out_outro, "@alexvera")

    # ── Distribuir b-rolls: uno cada ~5 segmentos de habla
    # Estructura: [segs 0-3] [broll0] [split1] [segs 4-7] [broll1] [split2] ...
    # Split = broll card top + speaker bottom (para los b-rolls con speaker)

    clips = []
    broll_idx = 0
    broll_every = max(3, len(segs) // max(1, len(brolls)))

    for i, seg in enumerate(seg_files):
        # Hook inicial: primeros 2 segmentos directo, sin b-roll
        if i == 0:
            # Primer segmento con whoosh
            whoosh_out = p(f"seg_{i:03d}_w.mp4")
            if add_whoosh(seg, whoosh_out):
                clips.append(whoosh_out)
            else:
                clips.append(seg)
            continue

        # Insertar b-roll card cada N segmentos
        if i > 0 and i % broll_every == 0 and broll_idx < len(broll_files):
            br = broll_files[broll_idx]

            # Split screen: card top + speaker bottom
            split_out = p(f"split_{broll_idx:02d}.mp4")
            if broll_idx < len(seg_files) - 1 and i < len(seg_files):
                split_card_speaker(br, seg, split_out)
                clips.append(split_out)
            else:
                clips.append(br)
                clips.append(seg)

            broll_idx += 1
            continue

        # Segmentos normales con whoosh
        whoosh_out = p(f"seg_{i:03d}_w.mp4")
        if add_whoosh(seg, whoosh_out):
            clips.append(whoosh_out)
        else:
            clips.append(seg)

    # Agregar b-rolls restantes al final antes del outro
    while broll_idx < len(broll_files):
        clips.append(broll_files[broll_idx])
        broll_idx += 1

    # Outro siempre al final
    clips.append(out_outro)

    # ── Concat final
    final = os.path.join(SCRATCH, "FINAL_Alex_Vera_Styled.mp4")
    concat(clips, final)

    # ── Info
    if os.path.exists(final):
        sz = os.path.getsize(final) / 1e6
        rd = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
            "format=duration", "-of", "csv=p=0", final],
            capture_output=True, text=True)
        dur_f = float(rd.stdout.strip()) if rd.stdout.strip() else 0
        print(f"\n🎬 FINAL: {final}")
        print(f"   {sz:.1f} MB  |  {dur_f:.1f}s  |  {W}×{H}")
        print(f"   Clips ensamblados: {len(clips)}")

        if sz > 28:
            print("\n⚠️  Recomprimiendo para reducir tamaño...")
            small = final.replace(".mp4", "_lite.mp4")
            run([
                "ffmpeg", "-i", final,
                "-c:v", "libx264", "-preset", "slow", "-crf", "26",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart", "-y", small
            ], "Recomprimir → lite")
            if os.path.exists(small):
                sz2 = os.path.getsize(small) / 1e6
                print(f"   Lite: {sz2:.1f} MB")
                return small

        return final


if __name__ == "__main__":
    produce()
