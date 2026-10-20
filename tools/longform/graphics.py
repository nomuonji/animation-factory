"""Small declarative motion graphics for factual explainers, at 960x540/24 fps."""
import json
import math
import pathlib
import subprocess
from PIL import Image, ImageDraw, ImageFont

FONT='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'


def value(v,t):
    if not isinstance(v,list) or not v or not isinstance(v[0],list):return v
    if t<=v[0][0]:return v[0][1]
    for (a,x),(b,y) in zip(v,v[1:]):
        if t<=b:
            p=(t-a)/(b-a)
            return x+(y-x)*p
    return v[-1][1]


def render(spec,root):
    path=root/spec['file'];path.parent.mkdir(parents=True,exist_ok=True)
    w,h,fps=960,540,24
    enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h}','-r',str(fps),'-i','-',
        '-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','19','-pix_fmt','yuv420p',str(path)],stdin=subprocess.PIPE)
    fonts={}
    try:
        for n in range(round(spec['duration']*fps)):
            t=n/fps
            im=Image.new('RGB',(w,h),spec.get('background','#0b1423'));d=ImageDraw.Draw(im)
            # Deliberately restrained: every moving mark encodes a value or event.
            for l in spec['layers']:
                if not l.get('from',0)<=t<l.get('until',spec['duration']):continue
                col=l.get('color','#edf2f9');x=value(l.get('x',0),t);y=value(l.get('y',0),t)
                if l['type']=='text':
                    size=l.get('size',30)
                    if size not in fonts:fonts[size]=ImageFont.truetype(FONT,size)
                    d.text((x,y),l['text'],font=fonts[size],fill=col,anchor=l.get('anchor','lt'),spacing=14)
                elif l['type']=='ellipse':
                    r=value(l.get('r',10),t);d.ellipse((x-r,y-r,x+r,y+r),fill=col)
                elif l['type']=='rect':
                    d.rounded_rectangle((x,y,x+value(l['w'],t),y+value(l['h'],t)),radius=l.get('radius',8),fill=col)
                elif l['type']=='line':
                    d.line((x,y,value(l['x2'],t),value(l['y2'],t)),fill=col,width=l.get('width',3))
                elif l['type']=='clock':
                    seconds=value(l['seconds'],t);size=l.get('size',72)
                    if size not in fonts:fonts[size]=ImageFont.truetype(FONT,size)
                    d.text((x,y),f'{seconds:+05.1f} 秒',font=fonts[size],fill=col)
            enc.stdin.write(im.tobytes())
        enc.stdin.close()
        if enc.wait()!=0:raise RuntimeError('graphic encoder failed')
    finally:
        if enc.poll() is None:enc.kill();enc.wait()
    return path


if __name__=='__main__':
    import sys
    p=pathlib.Path(sys.argv[1]).resolve()
    for s in json.loads(p.read_text()):render(s,p.parent)
