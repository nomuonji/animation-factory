#!/usr/bin/env python3
"""
A story-first Japanese Short using authentic camera footage of a panther chameleon
changing color when another male enters its field of vision.

The source is a research video, NOT synthetic recoloring; the footage was
accelerated 8x by its scientific authors. No channel upload.
"""
import json, math, os, pathlib, subprocess, sys, wave, urllib.request, urllib.parse
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT=pathlib.Path(__file__).resolve().parent.parent
DIR=ROOT/"outputs"/"chameleon-probe"
DIR.mkdir(parents=True,exist_ok=True)
W,H,FPS=720,1280,24
DURATION=21.2
N=round(DURATION*FPS)
SAMPLE=48000
FONT="/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
REG="/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
def font(size,bold=True):
    return ImageFont.truetype(FONT if bold else REG,size,index=0)
F100=font(88); F85=font(76); F72=font(68); F56=font(51); F44=font(39); F32=font(27)
BG=(9,17,21); WHITE=(248,249,239); MINT=(151,255,197); GOLD=(252,212,116); GRAY=(168,187,180)
SOURCE="Teyssier et al. (2015) · CC BY 4.0"
def center(draw, xy, text, f, fill=WHITE, stroke_width=0,stroke_fill=(0,0,0)):
    bbox=draw.textbbox((0,0),text,font=f,stroke_width=stroke_width)
    draw.text((xy[0]-(bbox[2]-bbox[0])/2,xy[1]),text,font=f,fill=fill,
              stroke_width=stroke_width,stroke_fill=stroke_fill)
def label(draw,x,y,txt,fill=MINT):
    draw.text((x,y),txt,font=F32,fill=fill)
def fillrounded(draw,box,fill,r=19,outline=None,width=2):
    draw.rounded_rectangle(box,radius=r,fill=fill,outline=outline,width=width)
def fit_cover(arr,w,h,scale=1.,cx=0.5,cy=0.5):
    sh,sw=arr.shape[:2]
    ratio=max(w/sw,h/sh)*scale
    nw,nh=math.ceil(sw*ratio),math.ceil(sh*ratio)
    r=cv2.resize(arr,(nw,nh),interpolation=cv2.INTER_CUBIC)
    x=int(max(0,min(nw-w,(nw-w)*cx)))
    y=int(max(0,min(nh-h,(nh-h)*cy)))
    return Image.fromarray(cv2.cvtColor(r[y:y+h,x:x+w],cv2.COLOR_BGR2RGB))
def load_video(path):
    cap=cv2.VideoCapture(str(path))
    if not cap.isOpened():raise RuntimeError("No real chameleon source: "+str(path))
    fps=cap.get(cv2.CAP_PROP_FPS); arr=[]
    while True:
        ok,frame=cap.read()
        if not ok:break
        arr.append(cv2.resize(frame,(960,540),interpolation=cv2.INTER_AREA))
    cap.release()
    print("Decoded source video frames:",len(arr),"fps:",fps,flush=True)
    if len(arr)<80 or fps<10:raise RuntimeError("Insufficient normalized scientific source frames")
    print(f"Loaded {len(arr)} real scientific frames at {fps:.2f}fps",flush=True)
    return arr,fps
frames,srcfps=load_video(DIR/"s2-normalized.mp4")
def shot(sec):
    return frames[max(0,min(len(frames)-1,int(sec*srcfps)))]
GREEN=shot(3.7)
RED=shot(12.6)
def imagecrop(arr,rect,rounded=14):
    x,y,w,h=rect
    res=fit_cover(arr,w,h)
    mask=Image.new("L",(w,h),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=rounded,fill=255)
    return res,mask
def putphoto(image,arr,rect,rounded=13,scale=1.0,cx=.5,cy=.5):
    x,y,w,h=rect
    p=fit_cover(arr,w,h,scale,cx,cy)
    mask=Image.new("L",(w,h),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,w,h),radius=rounded,fill=255)
    image.paste(p,(x,y),mask)
def split(image,progress=1):
    d=ImageDraw.Draw(image)
    for x,im,col,name in [(29,GREEN,MINT,"BEFORE"),(367,RED,GOLD,"AFTER")]:
        putphoto(image,im,(x,385,324,525),14,scale=1.0,cx=0.10)
        d=ImageDraw.Draw(image)
        d.rounded_rectangle((x,388,x+323,909),radius=14,outline=col,width=4)
        d.rounded_rectangle((x+12,405,x+164,450),radius=8,fill=BG)
        d.text((x+23,408),name,font=F32,fill=col)
    d=ImageDraw.Draw(image)
    center(d,(360,925),"同じ個体、同じ背景",F44)
    d.line((320,650,390,650),fill=(255,255,255),width=6)
    d.polygon([(390,650),(372,638),(372,662)],fill=(255,255,255))
def moving(image,sec,t,label_text,mark=False):
    # Film is real. MAIN: close enough to see green/yellow/red skin changes.
    # INSET: full view for orientation, synchronized from same source time.
    arr=shot(sec)
    # upper close-up takes maximum possible vertical space.
    putphoto(image,arr,(20,286,680,725),22,scale=1.04,cx=.14)
    putphoto(image,arr,(73,896,574,287),12,scale=1.0,cx=.5)
    d=ImageDraw.Draw(image)
    d.rounded_rectangle((21,288,699,1010),radius=22,outline=(81,124,111),width=3)
    d.rounded_rectangle((72,893,648,1178),radius=12,outline=GOLD,width=3)
    fillrounded(d,(88,899,184,940),BG,10)
    d.text((100,903),"全体",font=F32,fill=GOLD)
    label(d,38,234,label_text,GOLD)
    # No recoloring. This line represents time in the uploaded, accelerated footage.
    xx=48+int(min(1,max(0,(sec-3.5)/13.0))*624)
    d.rounded_rectangle((48,1206,672,1215),radius=4,fill=(46,66,63))
    d.rounded_rectangle((48,1206,xx,1215),radius=4,fill=MINT)
    d.ellipse((xx-9,1201,xx+9,1219),fill=GOLD)
def background(t):
    img=Image.new("RGB",(W,H),BG)
    d=ImageDraw.Draw(img)
    # A deliberately restrained graphic system; the scientific animal footage is the star.
    for i in range(0,725,62):
        d.line([(i,-1),(i-250,H)],fill=(13,27,29),width=2)
    fillrounded(d,(18,15,702,76),(21,41,41),14)
    d.text((38,29),"REAL EXPERIMENT  /  2015",font=F32,fill=MINT)
    d.text((38,92),"※ 研究者が8倍速にした映像",font=F32,fill=GRAY)
    d.text((25,1246),SOURCE,font=font(21,False),fill=(133,155,147))
    return img
def frame(t):
    im=background(t);d=ImageDraw.Draw(im)
    if t<1.85:
        # Hook A was chosen: instant before/after; B was verbal-first and was rejected.
        center(d,(360,190),"この2匹、同じ個体。",F56)
        split(im)
    elif t<11.6:
        sec=3.7+(t-1.85)*1.17
        moving(im,sec,t,"↓ 実際の変化を見てください",mark=True)
        d=ImageDraw.Draw(im)
        if t<5.4:
            center(d,(360,159),"背景は、ずっと黒。",F56)
        elif t<9.1:
            center(d,(360,159),"緑 → 黄 → 赤",F72,GOLD)
        else:
            center(d,(360,159),"むしろ目立ってる。",F56,GOLD)
    elif t<15.1:
        center(d,(360,180),"隠れるため？",F72,WHITE)
        split(im)
        d=ImageDraw.Draw(im)
        # Delayed reveal setup
        d.rounded_rectangle((66,1013,654,1098),radius=16,fill=(34,62,55))
        center(d,(360,1026),"まだ理由は言ってません",F44,GOLD)
    elif t<18.95:
        sec=10.5+min(4.7,(t-15.1)*1.16)
        moving(im,sec,t,"別のオスを見せたときの反応")
        d=ImageDraw.Draw(im)
        center(d,(360,159),"原因は、別のオス。",F56,GOLD)
    else:
        center(d,(360,191),"隠れるどころか",F56)
        split(im)
        d=ImageDraw.Draw(im)
        fillrounded(d,(39,1032,681,1138),(35,66,52),16)
        center(d,(360,1042),"相手を見て、目立った。",F56,MINT)
    # One short top/bottom phrase for mute viewing. Audio adds rather than duplicates.
    return im
def make_video():
    output=DIR/"video-only.mp4"
    proc=subprocess.Popen(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","rawvideo",
        "-pixel_format","rgb24","-video_size",f"{W}x{H}","-framerate",str(FPS),
        "-i","-","-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p",
        "-movflags","+faststart",str(output)],stdin=subprocess.PIPE)
    sampletimes=[0,1.8,2.5,6.1,9.5,12.8,16.8,19.8]
    for n in range(N):
        t=n/FPS
        im=frame(t)
        if any(abs(t-s)<.021 for s in sampletimes):
            im.save(DIR/(f"shot_{int(t*10):03d}.jpg"),quality=90)
        try:proc.stdin.write(im.tobytes())
        except BrokenPipeError:break
        if n%96==0:print(f"Rendered frame {n+1}/{N}",flush=True)
    proc.stdin.close()
    if proc.wait()!=0:raise RuntimeError("Video ffmpeg failed")
    return output
VOICE={
 "v0":(0.18,"これ、同じカメレオンです。"),
 "v1":(2.18,"背景はずっと黒いまま。"),
 "v2":(5.28,"でも、緑から黄色、赤へ。"),
 "v3":(9.67,"どんどん目立っていきます。"),
 "v4":(12.00,"隠れてるわけじゃ、ないんです。"),
 "v5":(15.20,"別のオスが見えた時の反応。"),
 "v6":(19.04,"隠れるどころか、自己主張。")
}
def nemo(text,filename):
    base=os.environ.get("VOICEVOX_URL","http://127.0.0.1:50021")
    speakers=json.load(urllib.request.urlopen(base+"/speakers",timeout=15))
    s=next((x for x in speakers if x["name"]=="男声2"),None)
    if not s:raise RuntimeError("Nemo male voice missing")
    speaker=s["styles"][0]["id"]
    url=base+"/audio_query?speaker="+str(speaker)+"&text="+urllib.parse.quote(text)
    request=urllib.request.Request(url,method="POST")
    query=json.load(urllib.request.urlopen(request,timeout=30))
    query["speedScale"]=1.22;query["intonationScale"]=1.10
    query["outputSamplingRate"]=48000
    query["outputStereo"]=False
    q=urllib.request.Request(base+"/synthesis?speaker="+str(speaker),
       data=json.dumps(query,ensure_ascii=False).encode(),
       headers={"Content-Type":"application/json"},method="POST")
    raw=urllib.request.urlopen(q,timeout=50).read()
    (DIR/filename).write_bytes(raw)
def sound(wavearr,t,duration,kind="impact",vol=1):
    st=int(t*SAMPLE);n=min(len(wavearr)-st,int(duration*SAMPLE))
    if n<=0:return
    tm=np.arange(n)/SAMPLE
    if kind=="impact":
        sig=np.sin(2*np.pi*(70*tm-40*tm*tm))*np.exp(-tm*18) + .18*np.random.default_rng(3).normal(size=n)*np.exp(-tm*22)
    elif kind=="glint":
        sig=(np.sin(2*np.pi*940*tm)+.25*np.sin(2*np.pi*1250*tm))*np.exp(-tm*10)
    elif kind=="riser":
        rng=np.random.default_rng(42);sig=rng.normal(size=n)*.25*(tm/duration)**1.3
    else:return
    wavearr[st:st+n]+=sig*vol
def create_audio():
    for name,(at,text) in VOICE.items():nemo(text,name+".wav")
    length=int(DURATION*SAMPLE)
    a=np.zeros(length,dtype=np.float64)
    t=np.arange(length,dtype=np.float64)/SAMPLE
    # Original, unlicensed music references NOT reused. Restrained ambient pulse 96 BPM,
    # held beneath the real animal and voice: no sound-effect-per-cut template.
    env=np.clip((t-1.5)/.8,0,1)*np.clip((DURATION-t)/1.3,0,1)
    a+=.017*(np.sin(2*np.pi*81.0*t)+.36*np.sin(2*np.pi*121.5*t))*env
    for beat in np.arange(2.,18.9,.625):
        st=int(beat*SAMPLE); dur=.19;n=int(dur*SAMPLE)
        if st+n>length:continue
        tm=np.arange(n)/SAMPLE
        a[st:st+n]+=.025*np.sin(2*np.pi*(93-25*tm)*tm)*np.exp(-tm*26)
    sound(a,.04,.4,"impact",.37)
    sound(a,1.84,.22,"glint",.19)
    sound(a,11.7,.35,"riser",.17)
    sound(a,15.1,.31,"impact",.11)
    # Voice is the reference in the mix; measure and normalize in final ffmpeg.
    for name,(at,text) in VOICE.items():
        with wave.open(str(DIR/(name+".wav")),"rb") as f:
            rate=f.getframerate();channels=f.getnchannels();width=f.getsampwidth()
            raw=f.readframes(f.getnframes())
        if width!=2:raise RuntimeError("Unexpected TTS bit depth")
        pcm=np.frombuffer(raw,dtype="<i2").astype(np.float64)/32768.0
        if channels==2:pcm=pcm.reshape(-1,2).mean(axis=1)
        if rate!=SAMPLE:
            # Nemo was requested at 48K; fail rather than silently drift voice sync.
            raise RuntimeError(f"Nemo returned {rate}, expected 48000")
        start=round(at*SAMPLE)
        n=min(len(pcm),len(a)-start)
        if n>0:a[start:start+n]+=pcm[:n]*.94
        print("Voice",name,at,"length",round(len(pcm)/SAMPLE,2),flush=True)
    mx=max(1,np.max(np.abs(a))/0.88)
    a=np.clip(a/mx,-1,1)
    path=DIR/"audio.wav"
    with wave.open(str(path),"wb") as o:
        o.setnchannels(1);o.setsampwidth(2);o.setframerate(SAMPLE)
        o.writeframes((a*32767).astype("<i2").tobytes())
    return path
def main():
    video=make_video()
    audio=create_audio()
    out=DIR/"chameleon_short_v1.mp4"
    subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y",
       "-i",str(video),"-i",str(audio),"-c:v","copy","-c:a","aac","-b:a","192k",
       "-t",str(DURATION),"-movflags","+faststart",str(out)],check=True)
    result=subprocess.check_output(["ffprobe","-v","error","-of","json",
     "-show_entries","format=duration,size:stream=codec_name,width,height,sample_rate",str(out)])
    metadata=json.loads(result)
    assert any(s.get("codec_name")=="h264" for s in metadata["streams"])
    assert any(s.get("codec_name")=="aac" for s in metadata["streams"])
    # Contact proof: output actual real frames, not a storyboard imagined in prose.
    thumbs=[]
    for sec in [0,.8,2.8,5.3,8.1,11.8,15.6,18.8,20.3]:
        cmd=["ffmpeg","-hide_banner","-loglevel","error","-y",
           "-ss",str(sec),"-i",str(out),"-frames:v","1",
           "-vf","scale=270:480","-f","image2pipe","-vcodec","mjpeg","pipe:1"]
        b=subprocess.check_output(cmd)
        import io
        thumbs.append(Image.open(io.BytesIO(b)).convert("RGB"))
    sheet=Image.new("RGB",(270*len(thumbs),480))
    for i,im in enumerate(thumbs):sheet.paste(im,(i*270,0))
    sheet.save(DIR/"edited-filmstrip.jpg",quality=89)
    (DIR/"video-metadata.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2))
    print("Finished film:",out,flush=True)
if __name__=="__main__":main()
