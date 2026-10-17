/**
 * Fetch only explicit, human-vetted Wikimedia Commons files for one production.
 * Evidence metadata and SHA1 from Wikimedia Commons API are required; no scraping.
 * Output media under public/visuals (not committed); render fails closed on missing assets.
 *
 * Usage: node tools/fetch-licensed-photos.mjs museum-idea-shorts-20261017-02
 */
import {readFile,mkdir,writeFile,stat,readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=fileURLToPath(new URL("../",import.meta.url));
const folder=process.argv[2];
if (!/^[a-z0-9_-]{1,100}$/i.test(folder||"")) throw Error("Explicit safe production folder required");
const p=JSON.parse(await readFile(join(root,"productions",folder,"production.json"),"utf8"));
const photoEvents=p.events.filter(e=>e.kind==="ui.photo");
if (!photoEvents.length) {
  console.log("No real photos requested: "+folder);
  process.exit(0);
}
const bank=join(root,"market-shorts","photo-bank");
const list=new Map();
for (const file of (await readdir(bank)).filter(n=>/^[a-z0-9-]+\.json$/.test(n))) {
  const manifest=JSON.parse(await readFile(join(bank,file),"utf8"));
  for (const photo of manifest.photos || []) {
    if (list.has(photo.id)) throw Error("Duplicate photo ID in bank: "+photo.id);
    list.set(photo.id,photo);
  }
}
const ids=[...new Set(photoEvents.map(x=>x.assetId))];
if (ids.length<3) throw Error("Photo-led Shorts require >=3 independently identifiable real photos");
const approved=new Set(["CC BY 4.0","CC BY-SA 3.0","CC BY-SA 4.0"]);
const ua="AnimationFactoryShortsPhotoBank/1.0 (https://github.com/nomuonji/animation-factory; editorial attribution verifier)";
async function request(url,{asJson=false,attempts=3}={}){
  for(let n=0;n<attempts;n++){
    try{
      const response=await fetch(url,{headers:{"User-Agent":ua,"Accept":asJson?"application/json":"image/*"},
        redirect:"follow",signal:AbortSignal.timeout(45000)});
      if (!response.ok) throw Error("HTTP "+response.status+" "+new URL(url).hostname);
      if (!asJson) {
        const len=Number(response.headers.get("content-length")||0);
        if (len>12_000_000) throw Error("Image too large");
      }
      return response;
    } catch(e){if(n===attempts-1)throw e;await new Promise(r=>setTimeout(r,1400*(n+1)));}
  }
}
const destDir=join(root,"public","visuals");await mkdir(destDir,{recursive:true});
const proof=[];
for(const id of ids){
  const photo=list.get(id);
  if (!photo || !approved.has(photo.license)|| !/^[a-z0-9-]+$/.test(id) ||
     !/^(jpg|png)$/.test(photo.extension) ||
     !photo.sourcePage?.startsWith("https://commons.wikimedia.org/wiki/File:"))
    throw Error("Photo has no approved source/rights: "+id);
  const api=new URL("https://commons.wikimedia.org/w/api.php");
  api.searchParams.set("action","query");
  api.searchParams.set("format","json");
  api.searchParams.set("formatversion","2");
  api.searchParams.set("prop","imageinfo");
  api.searchParams.set("iiprop","url|sha1|size|mime|extmetadata");
  api.searchParams.set("titles","File:"+photo.filename);
  const resp=await request(api,{asJson:true});const data=await resp.json();
  const info=data.query?.pages?.[0]?.imageinfo?.[0];
  if (!info || info.size<20000 || info.size>12_000_000 || !info.url || !info.sha1)
    throw Error("Commons image info unavailable: "+id);
  const license=String(info.extmetadata?.LicenseShortName?.value||"").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim();
  if (license!==photo.license)
    throw Error("License changed for "+id+": "+license+" expected "+photo.license);
  if (photo.expectedSha1 && photo.expectedSha1!==info.sha1.toLowerCase())
    throw Error("Source asset changed: "+id);
  const direct=new URL(info.url);
  if(direct.protocol!=="https:"||direct.hostname!=="upload.wikimedia.org")
    throw Error("Unexpected file URL for "+id);
  const image=await request(direct);
  const bytes=Buffer.from(await image.arrayBuffer());
  if(bytes.length!==info.size)throw Error("Source byte count mismatch: "+id);
  const sha=createHash("sha1").update(bytes).digest("hex");
  if(sha!==info.sha1.toLowerCase())throw Error("SHA1 mismatch: "+id);
  const imageSig=photo.extension==="png"
      ?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      :(bytes[0]===0xff&&bytes[1]===0xd8);
  if(!imageSig)throw Error("Unexpected file signature: "+id);
  const dst=join(destDir,id+"."+photo.extension);
  await writeFile(dst,bytes);
  if ((await stat(dst)).size!==bytes.length)throw Error("Corrupt downloaded asset");
  proof.push({id,bytes:bytes.length,sha1:sha,license,author:photo.author,sourcePage:photo.sourcePage,
    subject:photo.subject,path:"visuals/"+id+"."+photo.extension});
}
await writeFile(join(destDir,"ATTRIBUTION.json"),JSON.stringify(proof,null,2)+"\n");
console.log("Licensed photo files verified: "+JSON.stringify(proof.map(x=>({id:x.id,bytes:x.bytes,license:x.license}))));
