// Character bank: licenses, searchable cast and YouTube video usage rights.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const BANK_FILE = fileURLToPath(new URL("../character-bank/index.json", import.meta.url));

export async function loadBank(path = BANK_FILE) {
  return validateBank(JSON.parse(await readFile(path,"utf8")));
}
const fields = x => x && typeof x==="object" && !Array.isArray(x);
const tags = (character, key) => Array.isArray(character.tags?.[key]) ? character.tags[key] : [];

export function validateBank(bank) {
  if (!fields(bank) || bank.version !== 1 || !Array.isArray(bank.characters))
    throw Error("Invalid character-bank manifest");
  const seen = new Set();
  for (const character of bank.characters) {
    if (!/^[a-z0-9-]+$/.test(character.id || "") || seen.has(character.id))
      throw Error("Missing/duplicate character ID: "+character.id);
    seen.add(character.id);
    if (!fields(character.tags) || !tags(character,"role").length || !tags(character,"emotion").length ||
        !tags(character,"pose").length) throw Error("Character tags incomplete: "+character.id);
    if (character.sourceType === "project-original") {
      if (character.state !== "ready" || character.license!=="project-original" ||
          character.render?.kind !== "pixel-archetype" || character.render.archetype!==character.id)
        throw Error("Project original cannot be rendered: "+character.id);
      for (const key of ["H","S","W","J","T","P"]) {
        const n=character.palette?.[key];
        if (!Number.isInteger(n)||n<0||n>0xffffff) throw Error("Invalid palette "+character.id+"/"+key);
      }
    } else if (character.sourceType === "irasutoya") {
      if (character.state !== "reference_only" || character.render!==null ||
          !/^https:\/\/www\.irasutoya\.com\/20\d{2}\/\d{2}\/[a-z0-9_-]+\.html$/.test(character.sourceUrl||"") ||
          character.license!=="irasutoya-standard-terms" ||
          character.commercialPolicy?.maxDistinctPerVideo !== 20 ||
          character.commercialPolicy?.redistributionAllowed !== false)
        throw Error("Irasutoya reference must remain link-only without approved local media: "+character.id);
    } else throw Error("Unknown license/source category: "+character.id);
  }
  return bank;
}

export function findCast(bank, request) {
  const {role, emotion, pose, sourceType} = request;
  if (!role) throw Error("Role required");
  const matching=bank.characters
    .filter(c=>c.state==="ready" && c.render && (!sourceType || c.sourceType===sourceType))
    .filter(c=>tags(c,"role").includes(role))
    .map(c=>({asset:c, score:(emotion && tags(c,"emotion").includes(emotion) ? 8 : 0) +
     (pose && tags(c,"pose").includes(pose)?4:0)}))
    .sort((a,b)=>b.score-a.score || a.asset.id.localeCompare(b.asset.id));
  return matching[0]?.asset ?? null;
}

// The standard Irasutoya rules cap a commercial YouTube video's distinct illustrations
// at 20 (thumbnail included; repeated use of the same item counts once).
// Never interpret a source page URL as clearance to copy/download/redistribute an image.
export function validateVideoUsage(bank, {videoAssets = [],thumbnailAssets = [],commercial = true} = {}) {
  if (!Array.isArray(videoAssets)||!Array.isArray(thumbnailAssets))
    throw Error("videoAssets/thumbnailAssets must be arrays");
  const map=new Map(bank.characters.map(c=>[c.id,c]));
  const used=[...new Set([...videoAssets,...thumbnailAssets])];
  for (const id of used) {
    const item=map.get(id);
    if (!item) throw Error("Unknown character asset: "+id);
    if (item.state!=="ready"||!item.render)
      throw Error("Asset is reference-only and cannot render: "+id);
  }
  const irasutoya=used.filter(id=>map.get(id).sourceType==="irasutoya");
  const maximum=bank.policy?.irasutoya?.maxDistinctPerVideo;
  if (commercial && irasutoya.length>maximum)
    throw Error("Irasutoya commercial video limit exceeded: "+irasutoya.length+"/"+maximum);
  return {totalDistinct:used.length,irasutoyaDistinct:irasutoya.length,limit:maximum,
    thumbnailCount:[...new Set(thumbnailAssets)].length,used};
}
