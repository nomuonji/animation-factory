#!/usr/bin/env python3
"""Make a filmstrip from the ACTUAL research footage before any creative claims."""
import subprocess, pathlib
from PIL import Image, ImageDraw, ImageFont
out=pathlib.Path("outputs/chameleon-probe");out.mkdir(parents=True,exist_ok=True)
font="/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
try: face=ImageFont.truetype(font,31)
except OSError: face=ImageFont.load_default()
w,h=432,270; rows=[]
for group,filename in [("興奮時","s2.ogv"),("落ち着く時","s3.ogv")]:
    line=[]
    for sec in [0,3,6,9,12,15,18]:
        dst=out/f"{filename}-{sec}.jpg"
        subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-ss",str(sec),
            "-i",str(out/filename),"-frames:v","1","-vf",f"scale={w}:{h}",str(dst)],check=True)
        with Image.open(dst) as im: tile=im.convert("RGB").copy()
        dr=ImageDraw.Draw(tile);dr.rectangle([0,0,w,46],fill="#132021")
        dr.text((11,5),f"{group} {sec:02d}s",font=face,fill="#ffffff")
        line.append(tile)
    rows.append(line)
sheet=Image.new("RGB",(w*7,h*2),(20,24,27))
for i,line in enumerate(rows):
    for j,im in enumerate(line):sheet.paste(im,(j*w,i*h))
sheet.save(out/"filmstrip.jpg",quality=84)
print("Actual video filmstrip:",out/"filmstrip.jpg")
