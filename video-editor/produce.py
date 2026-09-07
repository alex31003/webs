#!/usr/bin/env python3
"""
PRODUCE.PY — Pipeline completo de edición profesional
Para videos de cara a cámara. Genera:
  - Color grade + enfoque en sujeto (desenfoque de fondo)
  - Intro animado (motion graphic)
  - B-roll animado (kinetic text, stat cards, listas, counters)
  - Split screen: speaker + b-roll
  - Captions sincronizados
  - Lower third animado
  - Outro con CTA
Todo en verde oscuro / mostaza / blanco — estilo único Alex Vera
"""

import subprocess, os, json, argparse, math

# ── PALETA ────────────────────────────────────────────────────────────────────
P = {
    "green":   "0x4ADE80",   # Verde claro
    "mustard": "0xD4A017",   # Mostaza
    "dark":    "0x0A1A10",   # Verde muy oscuro
    "white":   "white",
    "gray":    "0x9CA3AF",
    "black":   "black",
    "font":    "Arial-Bold",
    "mono":    "Courier",
    "W": 576, "H": 1024,
}

def run(cmd, label=""):
    r = subprocess.run(cmd, capture_output=True, text=True)
    print(("✅" if r.returncode == 0 else "❌") + f" {label}")
    if r.returncode != 0: print(r.stderr[-400:])
    return r.returncode == 0

def esc(s):
    return str(s).replace("'","").replace(":","\\:").replace(",","\\,").replace("[","").replace("]","")

def even(n): return n if n % 2 == 0 else n - 1


# ══════════════════════════════════════════════════════════════════════════════
# 1. COLOR GRADE + CROP + SCALE
# ══════════════════════════════════════════════════════════════════════════════
def color_grade(inp, out):
    """
    - Escala a 576x1024
    - Color grade: piel cálida, contraste, saturación
    - Viñeta sutil
    - Desenfoque de bordes (foco en centro)
    """
    W, H = P["W"], P["H"]
    vf = (
        f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
        # Corrección de color: piel más cálida, boost contraste
        f"eq=contrast=1.08:brightness=0.02:saturation=1.15:gamma=0.97,"
        # Curva S suave
        f"curves=r='0/0 0.4/0.38 1/1':g='0/0 0.4/0.41 1/1':b='0/0 0.45/0.40 1/1',"
        # Unsharp para sharpness
        f"unsharp=5:5:0.6:5:5:0,"
        # Viñeta
        f"vignette=PI/5"
    )
    return run([
        "ffmpeg", "-i", inp, "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-y", out
    ], f"Color grade → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# 2. INTRO ANIMADO (motion graphic)
# ══════════════════════════════════════════════════════════════════════════════
def make_intro(out, name="ALEX VERA", tagline="Emprendedor Digital", duration=3.5):
    """
    Intro oscuro animado:
    - Fondo verde muy oscuro
    - Barra mostaza animada de izquierda a derecha (0→1s)
    - Nombre aparece letra a letra (efecto máquina de escribir via fade)
    - Tagline debajo con verde claro
    - Barra de acento mostaza debajo del nombre
    """
    W, H = P["W"], P["H"]
    n, t = esc(name), esc(tagline)
    fps = 30

    # Usamos enable= para animar visibilidad
    vf = (
        # Barra mostaza superior (siempre)
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['mustard']}:t=fill,"
        # Línea horizontal animada (aparece en t=0.3)
        f"drawbox=x=0:y={H//2-5}:w={W}:h=3:color={P['mustard']}@0.4:t=fill:enable='gte(t,0.3)',"
        # Nombre grande — aparece en t=0.5 con fade
        f"drawtext=text='{n}':fontsize=72:fontcolor={P['white']}:x=(w-text_w)/2:y={H//2-90}"
        f":font={P['font']}:shadowcolor={P['green']}@0.4:shadowx=3:shadowy=3:enable='gte(t,0.5)',"
        # Tagline verde — aparece en t=1.2
        f"drawtext=text='{t}':fontsize=32:fontcolor={P['green']}:x=(w-text_w)/2:y={H//2+20}"
        f":font={P['font']}:enable='gte(t,1.2)',"
        # Subrayado mostaza bajo el nombre — en t=1.0
        f"drawbox=x=(w-460)/2:y={H//2-12}:w=460:h=4:color={P['mustard']}:t=fill:enable='gte(t,1.0)'"
    )
    return run([
        "ffmpeg",
        "-f", "lavfi", "-i", f"color={P['dark']}:size={W}x{H}:duration={duration}:rate={fps}",
        "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-y", out
    ], f"Intro animado → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# 3. B-ROLL: KINETIC TEXT (texto animado sobre fondo oscuro)
# ══════════════════════════════════════════════════════════════════════════════
def make_broll_kinetic(out, lines, duration=4.0, accent_line=0):
    """
    B-roll de texto cinético:
    - Fondo verde muy oscuro
    - Cada línea aparece escalonada (t=0, t=0.4, t=0.8...)
    - La línea accent_line en verde claro, resto en blanco
    - Barra mostaza top y left accent
    """
    W, H = P["W"], P["H"]
    n = len(lines)
    center_y = H // 2 - (n * 60) // 2

    vf = (
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['mustard']}:t=fill,"
        f"drawbox=x=0:y=0:w=8:h={H}:color={P['mustard']}@0.5:t=fill"
    )
    for i, line in enumerate(lines[:6]):
        color = P["green"] if i == accent_line else P["white"]
        size = 58 if i == accent_line else 40
        y = center_y + i * 70
        delay = 0.3 + i * 0.35
        vf += (
            f",drawtext=text='{esc(line)}':fontsize={size}:fontcolor={color}"
            f":x=(w-text_w)/2:y={y}:font={P['font']}"
            f":shadowcolor=black@0.7:shadowx=2:shadowy=2"
            f":enable='gte(t,{delay})'"
        )

    return run([
        "ffmpeg",
        "-f", "lavfi", "-i", f"color={P['dark']}:size={W}x{H}:duration={duration}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-y", out
    ], f"B-roll kinetic → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# 4. B-ROLL: STAT CARD (tarjeta de estadística animada)
# ══════════════════════════════════════════════════════════════════════════════
def make_broll_stat(out, number, label, sublabel="", duration=4.0):
    """
    Stat card: número grande centrado, animado
    Ejemplo: "10K", "Seguidores en 30 días"
    """
    W, H = P["W"], P["H"]
    num, lbl, sub = esc(number), esc(label), esc(sublabel)

    vf = (
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['mustard']}:t=fill,"
        # Caja central
        f"drawbox=x=60:y={H//2-160}:w={W-120}:h=320:color={P['mustard']}@0.08:t=fill,"
        f"drawbox=x=60:y={H//2-160}:w={W-120}:h=320:color={P['mustard']}@0.5:t=2,"
        # Número grande verde
        f"drawtext=text='{num}':fontsize=120:fontcolor={P['green']}"
        f":x=(w-text_w)/2:y={H//2-140}:font={P['font']}"
        f":shadowcolor={P['green']}@0.3:shadowx=4:shadowy=4:enable='gte(t,0.3)',"
        # Label mostaza
        f"drawtext=text='{lbl}':fontsize=34:fontcolor={P['mustard']}"
        f":x=(w-text_w)/2:y={H//2+30}:font={P['font']}:enable='gte(t,0.7)',"
        # Sublabel blanco
        + (f"drawtext=text='{sub}':fontsize=26:fontcolor={P['gray']}"
           f":x=(w-text_w)/2:y={H//2+80}:font={P['font']}:enable='gte(t,1.0)'" if sub else
           f"drawtext=text='':fontsize=1:fontcolor=black:x=0:y=0")
    )

    return run([
        "ffmpeg",
        "-f", "lavfi", "-i", f"color={P['dark']}:size={W}x{H}:duration={duration}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-y", out
    ], f"Stat card '{number}' → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# 5. B-ROLL: LISTA ANIMADA (checklist)
# ══════════════════════════════════════════════════════════════════════════════
def make_broll_list(out, title, items, duration=5.0):
    """Lista con checkmarks verdes que aparecen uno a uno"""
    W, H = P["W"], P["H"]
    t_esc = esc(title)
    start_y = 220

    vf = (
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['mustard']}:t=fill,"
        f"drawbox=x=0:y=0:w=8:h={H}:color={P['green']}@0.6:t=fill,"
        f"drawtext=text='{t_esc}':fontsize=44:fontcolor={P['mustard']}"
        f":x=(w-text_w)/2:y=120:font={P['font']}:enable='gte(t,0.2)'"
    )
    for i, item in enumerate(items[:6]):
        it = esc(item)
        y = start_y + i * 80
        delay = 0.5 + i * 0.5
        # Checkmark verde
        vf += (
            f",drawtext=text='✓':fontsize=36:fontcolor={P['green']}"
            f":x=50:y={y}:font={P['font']}:enable='gte(t,{delay})'"
            f",drawtext=text='{it}':fontsize=32:fontcolor={P['white']}"
            f":x=100:y={y+2}:font={P['font']}:enable='gte(t,{delay})'"
        )

    return run([
        "ffmpeg",
        "-f", "lavfi", "-i", f"color={P['dark']}:size={W}x{H}:duration={duration}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-y", out
    ], f"Lista animada → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# 6. LOWER THIRD (nombre del speaker)
# ══════════════════════════════════════════════════════════════════════════════
def add_lower_third(inp, out, name="Alex Vera", title="Emprendedor Digital"):
    """Agrega lower third animado al video del speaker"""
    W, H = P["W"], P["H"]
    n, t = esc(name), esc(title)
    lt_y = H - 280

    vf = (
        f"drawbox=x=0:y={lt_y}:w=420:h=90:color={P['dark']}@0.85:t=fill:enable='between(t,0.5,999)',"
        f"drawbox=x=0:y={lt_y}:w=6:h=90:color={P['mustard']}:t=fill:enable='between(t,0.5,999)',"
        f"drawtext=text='{n}':fontsize=36:fontcolor={P['white']}"
        f":x=20:y={lt_y+12}:font={P['font']}:enable='between(t,0.7,999)',"
        f"drawtext=text='{t}':fontsize=24:fontcolor={P['green']}"
        f":x=20:y={lt_y+52}:font={P['font']}:enable='between(t,0.9,4.0)'"
    )
    return run([
        "ffmpeg", "-i", inp, "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-y", out
    ], f"Lower third → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# 7. SPLIT SCREEN: SPEAKER (abajo 45%) + B-ROLL GENERADO (arriba 55%)
# ══════════════════════════════════════════════════════════════════════════════
def make_split_with_broll(speaker, broll, out, caption="", watermark="@tu_usuario"):
    """Split: b-roll generado arriba + speaker abajo con captions"""
    W, H = P["W"], P["H"]
    SY = even(int(H * 0.52))
    SH = even(H - SY)
    cap, wm = esc(caption), esc(watermark)

    fc = (
        f"[0:v]scale={W}:{SY}:force_original_aspect_ratio=increase,crop={W}:{SY}[broll];"
        f"[1:v]scale={W}:{SH}:force_original_aspect_ratio=increase,crop={W}:{SH},"
        f"lutrgb=r=val*0.88:g=val*0.97:b=val*0.82[spk];"
        f"[broll][spk]vstack=inputs=2,"
        f"drawbox=x=0:y=0:w={W}:h=7:color={P['mustard']}:t=fill,"
        f"drawbox=x=0:y={SY}:w={W}:h=5:color={P['mustard']}:t=fill"
        + (f",drawtext=text='{cap}':fontsize=34:fontcolor={P['mustard']}"
           f":x=(w-text_w)/2:y={SY+18}:font={P['font']}"
           f":shadowcolor=black:shadowx=2:shadowy=2" if cap else "")
        + f",drawtext=text='{wm}':fontsize=20:fontcolor=white@0.75"
          f":x=w-text_w-14:y=h-42:font={P['font']}[out]"
    )
    return run([
        "ffmpeg", "-i", broll, "-i", speaker,
        "-filter_complex", fc,
        "-map", "[out]", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-y", out
    ], f"Split+broll → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# 8. CAPTIONS sobre video fullscreen
# ══════════════════════════════════════════════════════════════════════════════
def add_captions(inp, out, segments, watermark="@tu_usuario"):
    """
    Agrega captions sincronizados.
    segments: [{"start": 0.0, "end": 2.5, "text": "Hola a todos"}, ...]
    """
    W, H = P["W"], P["H"]
    wm = esc(watermark)

    vf = (
        f"drawbox=x=0:y=0:w={W}:h=7:color={P['mustard']}:t=fill,"
        f"drawtext=text='{wm}':fontsize=20:fontcolor=white@0.75"
        f":x=w-text_w-14:y=h-42:font={P['font']}"
    )
    for seg in segments:
        t = esc(seg["text"])
        s, e = seg["start"], seg["end"]
        vf += (
            f",drawtext=text='{t}':fontsize=38:fontcolor=white"
            f":x=(w-text_w)/2:y=h-160:font={P['font']}"
            f":shadowcolor=black@0.95:shadowx=2:shadowy=2"
            f":box=1:boxcolor=black@0.45:boxborderw=12"
            f":enable='between(t,{s},{e})'"
        )

    return run([
        "ffmpeg", "-i", inp, "-vf", vf,
        "-map", "0:v", "-map", "0:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-y", out
    ], f"Captions → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# 9. OUTRO animado
# ══════════════════════════════════════════════════════════════════════════════
def make_outro(out, cta="Sígueme para más", username="@tu_usuario", duration=4.0):
    """Outro oscuro con CTA animado y username prominente"""
    W, H = P["W"], P["H"]
    c, u = esc(cta), esc(username)
    mid = H // 2

    vf = (
        f"drawbox=x=0:y=0:w={W}:h=8:color={P['mustard']}:t=fill,"
        f"drawbox=x=0:y={H-8}:w={W}:h=8:color={P['mustard']}:t=fill,"
        # CTA texto arriba
        f"drawtext=text='{c}':fontsize=38:fontcolor={P['white']}"
        f":x=(w-text_w)/2:y={mid-120}:font={P['font']}:enable='gte(t,0.4)',"
        # Caja mostaza username
        f"drawbox=x=60:y={mid-20}:w={W-120}:h=80:color={P['mustard']}@0.15:t=fill:enable='gte(t,0.8)',"
        f"drawbox=x=60:y={mid-20}:w={W-120}:h=80:color={P['mustard']}@0.7:t=2:enable='gte(t,0.8)',"
        # Username grande verde
        f"drawtext=text='{u}':fontsize=52:fontcolor={P['green']}"
        f":x=(w-text_w)/2:y={mid}:font={P['font']}"
        f":shadowcolor={P['green']}@0.3:shadowx=3:shadowy=3:enable='gte(t,1.0)'"
    )
    return run([
        "ffmpeg",
        "-f", "lavfi", "-i", f"color={P['dark']}:size={W}x{H}:duration={duration}:rate=30",
        "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-y", out
    ], f"Outro → {os.path.basename(out)}")


# ══════════════════════════════════════════════════════════════════════════════
# 10. CONCAT
# ══════════════════════════════════════════════════════════════════════════════
def concat(clips, out):
    lst = out + ".txt"
    with open(lst, "w") as f:
        for v in clips:
            if os.path.exists(v):
                f.write(f"file '{os.path.abspath(v)}'\n")
    ok = run([
        "ffmpeg", "-f", "concat", "-safe", "0", "-i", lst,
        "-c", "copy", "-y", out
    ], f"Final concat → {os.path.basename(out)}")
    os.remove(lst)
    return ok


# ══════════════════════════════════════════════════════════════════════════════
# PIPELINE COMPLETO
# ══════════════════════════════════════════════════════════════════════════════
def full_produce(
    speaker_video: str,
    output_dir: str,
    config: dict
):
    """
    Produce el video completo desde cero.
    config = {
        "name": "Alex Vera",
        "tagline": "Emprendedor Digital",
        "username": "@alexvera",
        "topic": "Cómo vender productos digitales",
        "cta": "Sígueme para más tips",
        "segments": [                          # captions manuales o de whisper
            {"start": 0, "end": 3, "text": "Hoy te voy a enseñar algo brutal"},
            ...
        ],
        "brolls": [                            # b-rolls a generar
            {"type": "kinetic", "lines": ["Vende más", "enseñando una sola cosa"], "accent": 0},
            {"type": "stat", "number": "10K", "label": "Seguidores en 30 días"},
            {"type": "list", "title": "Lo que necesitas:", "items": ["Un tema", "Una cámara", "Constancia"]},
        ]
    }
    """
    os.makedirs(output_dir, exist_ok=True)
    clips = []

    name     = config.get("name", "Tu Nombre")
    tagline  = config.get("tagline", "Emprendedor")
    username = config.get("username", "@tu_usuario")
    cta      = config.get("cta", "Sígueme para más")
    segments = config.get("segments", [])
    brolls   = config.get("brolls", [])

    print(f"\n{'='*50}")
    print(f"  PRODUCIENDO: {config.get('topic','Video')}")
    print(f"{'='*50}\n")

    # ① Intro
    intro_out = f"{output_dir}/01_intro.mp4"
    make_intro(intro_out, name, tagline, duration=3.5)
    clips.append(intro_out)

    # ② Color grade del speaker
    graded = f"{output_dir}/speaker_graded.mp4"
    color_grade(speaker_video, graded)

    # ③ Trim del speaker: primer segmento (0-30s) con lower third
    spk_lt = f"{output_dir}/02_speaker_lt.mp4"
    # Primeros 8 segundos con lower third, luego sin él
    trimmed = f"{output_dir}/spk_trim1.mp4"
    run([
        "ffmpeg", "-i", graded, "-ss", "0", "-t", "8",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-y", trimmed
    ], "Trim speaker 0-8s")
    add_lower_third(trimmed, spk_lt, name, tagline)
    clips.append(spk_lt)

    # ④ B-rolls intercalados con split screens
    spk_offset = 8  # segundos ya usados del speaker
    for i, br_cfg in enumerate(brolls):
        br_type = br_cfg.get("type", "kinetic")
        br_out  = f"{output_dir}/broll_{i+1:02d}.mp4"
        br_dur  = br_cfg.get("duration", 4.0)

        # Generar b-roll según tipo
        if br_type == "kinetic":
            make_broll_kinetic(br_out, br_cfg.get("lines", ["Texto"]),
                               br_dur, br_cfg.get("accent", 0))
        elif br_type == "stat":
            make_broll_stat(br_out, br_cfg.get("number","0"),
                            br_cfg.get("label",""), br_cfg.get("sublabel",""), br_dur)
        elif br_type == "list":
            make_broll_list(br_out, br_cfg.get("title",""),
                            br_cfg.get("items",[]), br_dur)

        # Trim del speaker correspondiente
        spk_seg = f"{output_dir}/spk_seg_{i+1:02d}.mp4"
        run([
            "ffmpeg", "-i", graded, "-ss", str(spk_offset), "-t", str(br_dur),
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k", "-y", spk_seg
        ], f"Trim speaker {spk_offset}s-{spk_offset+br_dur}s")

        # Split: b-roll arriba + speaker abajo
        caption = br_cfg.get("caption", "")
        split_out = f"{output_dir}/split_{i+1:02d}.mp4"
        make_split_with_broll(spk_seg, br_out, split_out, caption, username)
        clips.append(split_out)
        spk_offset += br_dur

    # ⑤ Segmento final del speaker (lo que queda) con captions
    spk_final = f"{output_dir}/spk_final.mp4"
    run([
        "ffmpeg", "-i", graded, "-ss", str(spk_offset),
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-y", spk_final
    ], f"Speaker final desde {spk_offset}s")

    if segments:
        spk_cap = f"{output_dir}/03_speaker_cap.mp4"
        add_captions(spk_final, spk_cap, segments, username)
        clips.append(spk_cap)
    else:
        # Sin segmentos: agregar watermark y caption genérico
        spk_wm = f"{output_dir}/03_speaker_wm.mp4"
        run([
            "ffmpeg", "-i", spk_final,
            "-vf", f"drawtext=text='{esc(username)}':fontsize=20:fontcolor=white@0.75"
                   f":x=w-text_w-14:y=h-42:font={P['font']},"
                   f"drawbox=x=0:y=0:w={P['W']}:h=7:color={P['mustard']}:t=fill",
            "-map", "0:v", "-map", "0:a",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k", "-y", spk_wm
        ], "Speaker final con watermark")
        clips.append(spk_wm)

    # ⑥ Outro
    outro_out = f"{output_dir}/04_outro.mp4"
    make_outro(outro_out, cta, username, duration=4.0)
    clips.append(outro_out)

    # ⑦ CONCAT FINAL
    final_out = f"{output_dir}/FINAL_{name.replace(' ','_')}.mp4"
    concat(clips, final_out)

    sz = os.path.getsize(final_out) / 1024 / 1024 if os.path.exists(final_out) else 0
    print(f"\n🎬 VIDEO FINAL: {final_out} ({sz:.1f} MB)")
    print(f"🎞️  Clips: {len(clips)}")
    return final_out


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Pipeline completo de producción de video")
    p.add_argument("speaker", help="Video del speaker (cámara frontal)")
    p.add_argument("-o", "--output-dir", default="./produccion")
    p.add_argument("--config", help="JSON con configuración completa")
    p.add_argument("--name", default="Alex Vera")
    p.add_argument("--tagline", default="Emprendedor Digital")
    p.add_argument("--username", default="@tu_usuario")
    p.add_argument("--topic", default="Mi video")
    p.add_argument("--cta", default="Sigueme para mas tips")
    args = p.parse_args()

    if args.config:
        with open(args.config) as f:
            cfg = json.load(f)
    else:
        # Config de ejemplo con b-rolls por defecto
        cfg = {
            "name": args.name,
            "tagline": args.tagline,
            "username": args.username,
            "topic": args.topic,
            "cta": args.cta,
            "brolls": [
                {
                    "type": "kinetic",
                    "lines": ["Como vender", "sin tener", "un gran seguimiento"],
                    "accent": 0,
                    "duration": 4.0,
                    "caption": "esto cambia todo"
                },
                {
                    "type": "stat",
                    "number": "3x",
                    "label": "mas ventas",
                    "sublabel": "con el mismo contenido",
                    "duration": 3.5,
                    "caption": "los numeros no mienten"
                },
                {
                    "type": "list",
                    "title": "Lo que necesitas:",
                    "items": [
                        "Un problema real que resolver",
                        "Una solucion probada",
                        "Comunicarlo con claridad",
                        "Consistencia en el tiempo",
                    ],
                    "duration": 5.0,
                    "caption": "asi de simple"
                },
            ]
        }

    full_produce(args.speaker, args.output_dir, cfg)
