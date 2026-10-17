#!/usr/bin/env python3
"""
Reusable real-footage Shorts editor: narrative beat manifest -> editable vertical MP4.
Actual motion is decoded from verified video files, not simulated with replacement
photos. This renders a review draft, NOT publish approval or an automated upload.
Dependencies: ffmpeg, cv2, numpy, Pillow. Live narration: local VOICEVOX Nemo.
Usage: python tools/footage-first-render.py productions/<slug>/footage-first.json
"""
import hashlib, io, json, math, os, pathlib, subprocess, sys, time, urllib.request, urllib.parse, wave
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT=pathlib.Path(__file__).resolve().parent.parent
MEDIA=ROOT/"outputs"/"footage-first-sources"
OUT=ROOT/"outputs"/"footage-first"
RATE=48000
C=(11,18,23)
WHITE=(245,247,244)
MINT=(149,255,202)
YELLOW=(254,218,128)
DIM=(164,181,179)
FONT="/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
def font(size):
    try: return ImageFont.truetype(FONT,size,index=0)
    except OSError: return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",size)
F=[font(x) for x in [20,28,38,51,62,75]]
def exec_cmd(args,quiet=False):
    return subprocess.run(args,check=True,stdout=subprocess.PIPE if quiet else None,
                          stderr=subprocess.PIPE if quiet else None)
def get_media(source,demo):
    sid=source["id"]
    dest=MEDIA/(sid+".source")
    if demo:
        if not dest.is_file(): raise RuntimeError("Missing explicit demo test footage: "+str(dest))
        return dest
    if dest.is_file():
        digest=hashlib.sha1(dest.read_bytes()).hexdigest()
        if digest==source["sha1"]:return dest
        dest.unlink()
    url=source["downloadUrl"]
    if not url.startswith("https://upload.wikimedia.org/wikipedia/commons/"):
        raise RuntimeError("Unapproved footage host "+sid)
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":
                "AnimationFactory-FootageFirst/1.0 (https://github.com/nomuonji/animation-factory)"},
                method="GET")
            with urllib.request.urlopen(req,timeout=50) as response:
                raw=response.read(200_000_001)
            if len(raw)>200_000_000:raise RuntimeError("Footage file too large")
            if hashlib.sha1(raw).hexdigest()!=source["sha1"]:
                raise RuntimeError("Original media checksum differs: "+sid)
            dest.write_bytes(raw)
            return dest
        except Exception:
            if attempt==2:raise
            time.sleep(1.3*(attempt+1))
    raise RuntimeError("Unable to fetch "+sid)
def normalize(source,path,fps):
    normalized=MEDIA/(source["id"]+"-normalized.mp4")
    exec_cmd(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(path),"-an",
      "-vf",f"fps={fps},scale=960:540:flags=lanczos", "-c:v","libx264","-preset","veryfast",
      "-crf","14","-pix_fmt","yuv420p",str(normalized)])
    cap=cv2.VideoCapture(str(normalized))
    frames=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    if frames < fps:raise RuntimeError("Footage empty or corrupted: "+source["id"])
    return normalized,frames/fps

class VideoCursor:
    def __init__(self,path,fps):
        self.path=path;self.fps=fps;self.cap=cv2.VideoCapture(str(path));self.next=0
        if not self.cap.isOpened():raise RuntimeError("Could not decode "+str(path))
    def read(self,sec):
        target=max(0,int(sec*self.fps))
        if target<self.next or target>self.next+50:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES,target);self.next=target
        while self.next<target:
            if not self.cap.grab():raise RuntimeError("Source footage ended before requested in-point")
            self.next+=1
        ok,frame=self.cap.read();self.next+=1
        if not ok:raise RuntimeError("Source footage ended before requested in-point")
        return frame
    def close(self):self.cap.release()

def cover(frame,w,h,cx=.5):
    sh,sw=frame.shape[:2]
    scale=max(w/sw,h/sh)
    nw,nh=int(math.ceil(sw*scale)),int(math.ceil(sh*scale))
    src=cv2.resize(frame,(nw,nh),interpolation=cv2.INTER_CUBIC)
    x=int((nw-w)*max(0,min(1,cx)))
    y=max(0,(nh-h)//2)
    return Image.fromarray(cv2.cvtColor(src[y:y+h,x:x+w],cv2.COLOR_BGR2RGB))
def contain(frame,w,h):
    sh,sw=frame.shape[:2]
    scale=min(w/sw,h/sh)
    nw,nh=max(1,int(sw*scale)),max(1,int(sh*scale))
    src=cv2.resize(frame,(nw,nh))
    pic=Image.fromarray(cv2.cvtColor(src,cv2.COLOR_BGR2RGB))
    tile=Image.new("RGB",(w,h),(18,28,32));tile.paste(pic,((w-nw)//2,(h-nh)//2))
    return tile
def text_center(d,xy,text,f,color=WHITE):
    bb=d.textbbox((0,0),text,font=f)
    d.text((xy[0]-(bb[2]-bb[0])/2,xy[1]),text,font=f,fill=color)
def rounded(img,frame,x,y,w,h,fit="cover",fx=.5,radius=18):
    picture=(cover(frame,w,h,fx) if fit=="cover" else contain(frame,w,h))
    mask=Image.new("L",(w,h),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=radius,fill=255)
    img.paste(picture,(x,y),mask)

def draw_frame(beat,frame,other,at,width,height,credit):
    im=Image.new("RGB",(width,height),C)
    d=ImageDraw.Draw(im)
    # Visual hierarchy: actual footage first, on-screen text secondary.
    d.rounded_rectangle((18,17,702,71),radius=12,fill=(27,46,43))
    d.text((37,27),"REAL FOOTAGE",font=F[1],fill=MINT)
    text_center(d,(360,126),beat["onScreen"],F[4] if len(beat["onScreen"])<=11 else F[3])
    progress=min(1,at/beat["duration"])
    kind=beat["layout"]
    if kind=="compare":
        rounded(im,frame,22,274,330,710,fx=beat.get("focalX",.5))
        rounded(im,other,369,274,330,710,fx=beat.get("focalX",.5))
        d=ImageDraw.Draw(im)
        d.rounded_rectangle((29,291,155,342),radius=11,fill=(17,30,35))
        d.text((42,302),"BEFORE",font=F[1],fill=MINT)
        d.rounded_rectangle((376,291,505,342),radius=11,fill=(17,30,35))
        d.text((388,302),"AFTER",font=F[1],fill=YELLOW)
    elif kind=="motion":
        rounded(im,frame,23,259,674,761,fx=beat.get("focalX",.5))
        rounded(im,frame,72,892,577,285,fit="contain",radius=12)
        d=ImageDraw.Draw(im)
        d.rounded_rectangle((69,889,651,1180),radius=13,outline=YELLOW,width=3)
        d.rounded_rectangle((81,898,151,938),radius=8,fill=C)
        d.text((90,904),"全体",font=F[0],fill=YELLOW)
    elif kind=="wide":
        rounded(im,frame,18,325,684,645,fit="contain")
    else:raise RuntimeError("Unsupported shot layout")
    d=ImageDraw.Draw(im)
    d.rectangle((33,1204,687,1210),fill=(42,64,63))
    d.rectangle((33,1204,33+int(654*progress),1210),fill=MINT)
    d.text((27,1243),credit,font=F[0],fill=DIM)
    return im

def voicevox(text,out,profile):
    base=os.environ.get("VOICEVOX_URL","http://127.0.0.1:50021")
    speakers=json.load(urllib.request.urlopen(base+"/speakers",timeout=25))
    speaker=next((s for s in speakers if s["name"]==profile.get("voice","男声2")),None)
    if not speaker:raise RuntimeError("VOICEVOX Nemo voice not installed")
    style=speaker["styles"][0]["id"]
    request=urllib.request.Request(base+"/audio_query?text="+urllib.parse.quote(text)+"&speaker="+str(style),method="POST")
    query=json.load(urllib.request.urlopen(request,timeout=35))
    query["speedScale"]=profile.get("speedScale",1.2)
    query["outputSamplingRate"]=RATE;query["outputStereo"]=False
    req=urllib.request.Request(base+"/synthesis?speaker="+str(style),method="POST",
       data=json.dumps(query,ensure_ascii=False).encode(),headers={"Content-Type":"application/json"})
    out.write_bytes(urllib.request.urlopen(req,timeout=60).read())

def build_audio(brief,localout,duration):
    n=int((duration+.1)*RATE);a=np.zeros(n,np.float64)
    tt=np.arange(n,dtype=np.float64)/RATE
    # This is intentionally restrained, not a sound-effect-per-cut rule.
    attack=np.minimum(1,tt/0.85)
    release=np.minimum(1,np.maximum(0,(duration-tt)/1.2))
    a+=(.012*np.sin(2*np.pi*92.5*tt)+.007*np.sin(2*np.pi*138.75*tt))*attack*release
    provider=brief.get("voice",{}).get("provider","none")
    pos=0
    for i,b in enumerate(brief["beats"]):
        if b.get("soundCue") in ("hit","reveal"):
            st=int(pos*RATE);count=int(.38*RATE);t=np.arange(count)/RATE
            effect=(.25 if b["soundCue"]=="hit" else .12)*np.sin(2*np.pi*(102-28*t)*t)*np.exp(-15*t)
            a[st:st+count]+=effect[:len(a[st:st+count])]
        spoken=b.get("narration")
        if spoken and provider=="voicevox-nemo":
            f=localout/("voice-"+str(i)+".wav");voicevox(spoken,f,brief["voice"])
            with wave.open(str(f),"rb") as w:
                sr=w.getframerate();channels=w.getnchannels();bits=w.getsampwidth()
                raw=w.readframes(w.getnframes())
            if sr!=RATE or bits!=2:raise RuntimeError("VOICEVOX Nemo sampling unexpected")
            pcm=np.frombuffer(raw,dtype="<i2").astype(np.float64)/32768.
            if channels==2:pcm=pcm.reshape(-1,2).mean(axis=1)
            start=int((pos+.2)*RATE)
            if len(pcm)>int((b["duration"]-.1)*RATE):
                raise RuntimeError("Narration does not fit its visual beat: "+b["id"])
            a[start:start+len(pcm)]+=.9*pcm
        pos+=b["duration"]
    a=np.clip(a,-.9,.9)
    path=localout/"audio.wav"
    with wave.open(str(path),"wb") as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE)
        w.writeframes((a*32767).astype("<i2").tobytes())
    return path

def main():
    if len(sys.argv)!=2:raise RuntimeError("Usage: python tools/footage-first-render.py <brief.json>")
    brief_path=pathlib.Path(sys.argv[1]).resolve()
    if not brief_path.is_relative_to(ROOT/"productions"):raise RuntimeError("Brief must be inside productions/")
    # Node validator is the shared source of truth for rights and beat structure.
    exec_cmd(["node",str(ROOT/"tools/footage-first-validate.mjs"),str(brief_path)],quiet=True)
    brief=json.loads(brief_path.read_text())
    OUT.mkdir(parents=True,exist_ok=True);MEDIA.mkdir(parents=True,exist_ok=True)
    localout=OUT/brief["id"];localout.mkdir(parents=True,exist_ok=True)
    fps=brief["canvas"]["fps"];width=720;height=1280
    sources={}
    for s in brief["sources"]:
        orig=get_media(s,brief["demoOnly"])
        norm,sec=normalize(s,orig,fps)
        sources[s["id"]]={"path":norm,"duration":sec,"credit":s.get("credit",s["title"])}
    total=sum(beat["duration"] for beat in brief["beats"])
    for b in brief["beats"]:
        duration=sources[b["sourceId"]]["duration"]
        to=b["sourceIn"]+(b["duration"]-1/fps)*b["rate"]
        if b["layout"]=="compare":
            to=max(b["compareAt"])
        if to>duration+0.005:raise RuntimeError("Beat '"+b["id"]+"' runs beyond verified footage")
    video=localout/"silent.mp4"
    cmd=["ffmpeg","-hide_banner","-loglevel","error","-y","-f","rawvideo","-pixel_format","rgb24",
         "-video_size","720x1280","-framerate",str(fps),"-i","pipe:0",
         "-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p",
         "-movflags","+faststart",str(video)]
    enc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    samples=[]
    for beat in brief["beats"]:
        s=sources[beat["sourceId"]]
        cursor=VideoCursor(s["path"],fps)
        if beat["layout"]=="compare":
            left=cursor.read(beat["compareAt"][0]);right=cursor.read(beat["compareAt"][1])
        else:left=right=None
        n=round(beat["duration"]*fps)
        for i in range(n):
            sec=(i/fps)
            frame=(cursor.read(beat["sourceIn"]+sec*beat["rate"])
                   if beat["layout"]!="compare" else left)
            image=draw_frame(beat,frame,right,sec,width,height,
                       "SOURCE / "+s["credit"][:76])
            if i==0 or i==n//2: samples.append(image.resize((270,480)))
            try:enc.stdin.write(image.tobytes())
            except BrokenPipeError:break
        cursor.close()
        print("Visual beat:",beat["id"],beat["layout"],beat["duration"],flush=True)
    enc.stdin.close()
    if enc.wait()!=0:raise RuntimeError("Video encoder failed")
    audio=build_audio(brief,localout,total)
    final=localout/"video.mp4"
    exec_cmd(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(video),
      "-i",str(audio),"-c:v","libx264","-preset","fast","-crf","19",
      "-vf","scale=1080:1920:flags=lanczos","-pix_fmt","yuv420p",
      "-c:a","aac","-b:a","192k","-ar","48000",
      "-af","loudnorm=I=-17:TP=-1.5:LRA=10",
      "-t",str(total),"-movflags","+faststart",str(final)])
    cols=min(5,len(samples))
    rows=math.ceil(len(samples)/cols)
    sheet=Image.new("RGB",(270*cols,480*rows))
    for i,im in enumerate(samples):sheet.paste(im,((i%cols)*270,(i//cols)*480))
    sheet.save(localout/"review-filmstrip.jpg",quality=89)
    print(json.dumps({"video":str(final),"review":str(localout/"review-filmstrip.jpg"),
      "seconds":round(total,2),"beats":len(brief["beats"]),"editorialStatus":brief["publishStatus"]}),flush=True)
if __name__=="__main__":main()
