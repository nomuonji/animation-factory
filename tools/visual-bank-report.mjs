/**
 * Read-only report of already downloaded visual assets.
 * Real images and sprites can be looked up by package/source/license;
 * this tool does not claim that every sprite is automatically used by Shorts.
 */
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { resolve, relative, sep, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
const extensions=new Set([".png",".jpg",".jpeg",".webp",".svg"]);
function local(base,file) {
  const path=resolve(base,file);
  const rel=relative(base,path);
  if (!rel || rel===".." || rel.startsWith(".."+sep) || rel.includes("\0"))
    throw new Error("Asset path escapes workspace: "+file);
  return path;
}
async function list(folder) {
  const out=[];
  for (const entry of await readdir(folder,{withFileTypes:true})) {
    if (entry.isSymbolicLink()) continue;
    const file=join(folder,entry.name);
    if (entry.isDirectory()) out.push(...await list(file));
    else if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) out.push(file);
  }
  return out.sort((a,b)=>a.localeCompare(b));
}
const catalog=JSON.parse(await readFile(join(root,"catalog/asset-library.json"),"utf8"));
const result={backgrounds:[],packs:[],totalFiles:0};
for (const x of catalog.backgrounds || []) {
  const path=local(root,x.logical);
  if (!(await stat(path)).size) throw new Error("Missing/empty licensed background: "+x.id);
  result.backgrounds.push({id:x.id,relativePath:x.logical,license:x.license,origin:x.origin,
    use:x.use,readyFor:"visual-reference"});
  result.totalFiles++;
}
for (const p of catalog.packs || []) {
  if (p.kind!=="sprites") continue;
  if (p.license!=="CC0-1.0" || !p.source?.startsWith("https://kenney.nl/assets/"))
    throw new Error("Sprite pack not approved: "+p.id);
  const lic=await readFile(local(root,p.licenseFile),"utf8");
  if (!/cc0|creative commons zero/i.test(lic)) throw new Error("Missing CC0 license: "+p.id);
  const files=await list(local(root,p.path));
  if (!files.length) throw new Error("Sprite pack empty: "+p.id);
  result.packs.push({id:p.id,count:files.length,license:p.license,source:p.source,
    use:p.use,examplePaths:files.slice(0,5).map(f=>relative(root,f).split(sep).join("/")),
    readyFor:"asset-selection-not-rendering"});
  result.totalFiles+=files.length;
}
console.log(JSON.stringify(result,null,2));
