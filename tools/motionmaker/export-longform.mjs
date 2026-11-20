// Export a longform concept as a Shin-MotionMaker request, without changing the original.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const repository = path.resolve(fileURLToPath(new URL("../../",import.meta.url)));

export function toMotionMakerRequest(production) {
  if (!production || typeof production !== "object" || Array.isArray(production)) throw Error("Invalid production");
  for (const key of ["id","title","audience","question","payoff"])
    if (typeof production[key] !== "string" || !production[key].trim()) throw Error("Missing " + key);
  if (!Array.isArray(production.chapters) || production.chapters.length === 0) throw Error("Missing chapters");
  const outline = [
    "冒頭の問い: " + production.question,
    "最後の回収: " + production.payoff,
    ...production.chapters.map((chapter,i)=>{
      if (!chapter || !Array.isArray(chapter.beats)) throw Error("Invalid chapter " + (i+1));
      const beats = chapter.beats.map((beat,j)=>{
        const shots = Array.isArray(beat.shots) ? beat.shots.map(s=>s?.src).filter(v=>typeof v==="string").join(", ") : "";
        return "  "+(j+1)+". "+(beat.why||"")+"\n    narration: "+(beat.say||"")+"\n    reference shots (verify source and rights separately): "+shots;
      }).join("\n");
      return "章 "+(i+1)+": "+(chapter.title||chapter.id||"")+"\n目的: "+(chapter.purpose||"")+"\n"+beats;
    })
  ].join("\n\n");
  return {
    form: {
      videoMode:"explanation",styleMode:"motion",fullScreen:true,
      title:production.title,description:production.question,
      audience:production.audience,takeaway:production.payoff,outline,
      instructions:"長尺企画の問い・根拠・章構成を参考に、自由に映像演出を実装する。参照ショットは原典と利用条件を確認してから取得する。公開・投稿しない。",
      voiceEngine:"none",generateAudio:false,imageGeneration:false,videoGeneration:false,
      characterUsage:"none",allowWebResearch:false,evidencePolicy:"supplied-only",
      width:1920,height:1080,fps:30
    },assets:{}
  };
}
async function main() {
  const [input,output] = process.argv.slice(2);
  if (!input || !output) throw Error("Usage: node tools/motionmaker/export-longform.mjs productions/<id>/longform.json <output.json>");
  const inFile = path.resolve(input);
  if (!inFile.startsWith(path.join(repository,"productions")+path.sep) || path.basename(inFile)!=="longform.json")
    throw Error("Input must be a productions/<id>/longform.json file");
  const src=JSON.parse(await fs.readFile(inFile,"utf8"));
  const request=toMotionMakerRequest(src);
  const outFile=path.resolve(output);
  await fs.mkdir(path.dirname(outFile),{recursive:true});
  await fs.writeFile(outFile,JSON.stringify(request,null,2)+"\n",{flag:"wx"});
  console.log("Exported " + src.id + " to " + outFile + "; no video or publishing action performed.");
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{console.error(e.message);process.exitCode=1;});
