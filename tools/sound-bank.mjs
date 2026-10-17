/**
 * Offline catalog of previously downloaded and locally stored, verified CC0 sounds.
 * Sound choice is deterministic and restricted to allowlisted Kenney asset packs.
 * No remote fetching, unlicensed viral music, or arbitrary user file paths.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { join, relative, resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
const APPROVED = new Set(["interface-sounds", "impact-sounds", "music-jingles"]);
const EXTENSIONS = new Set([".ogg", ".wav", ".mp3"]);
export const SOUND_ROLES = Object.freeze({
  hook_hit: { pack: "impact-sounds", filter: /impact|hard|heavy|metal|wood|thud|hit|slap|punch/i, maxDuration: 0.9 },
  impact: { pack: "impact-sounds", filter: /impact|hit|thud|metal|wood/i, maxDuration: 0.9 },
  thud: { pack: "impact-sounds", filter: /soft|wood|low|medium|impact/i, maxDuration: 0.7 },
  pop: { pack: "interface-sounds", filter: /click|pop|switch|tap|tick|select|confirm/i, maxDuration: 0.45 },
  click: { pack: "interface-sounds", filter: /click|tap|tick|select/i, maxDuration: 0.35 },
  transition: { pack: "interface-sounds", filter: /slide|move|swipe|switch|scroll|open|close/i, maxDuration: 0.65 },
  reveal: { pack: "music-jingles", filter: /success|positive|complete|win|up|confirm|power/i, maxDuration: 1.5 },
  fail: { pack: "music-jingles", filter: /lose|negative|fail|down|sad|game/i, maxDuration: 1.25 },
  suspense: { pack: "music-jingles", filter: /suspense|danger|short|low|negative/i, maxDuration: 1.2 }
});
let bankCache;

async function enumerate(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const all = [];
  for (const item of entries) {
    if (item.isSymbolicLink()) continue;
    const full = join(dir, item.name);
    if (item.isDirectory()) all.push(...await enumerate(full));
    else if (item.isFile() && EXTENSIONS.has(extname(item.name).toLowerCase())) all.push(full);
  }
  return all.sort((a,b) => a.localeCompare(b));
}
function contained(base, value) {
  const rel = relative(base, value);
  return rel && rel !== ".." && !rel.startsWith(".." + sep) && !rel.includes("\0");
}
export async function inventorySoundBank(root = ROOT) {
  const base = resolve(root);
  if (bankCache?.root === base) return bankCache.promise;
  const promise = (async () => {
    const catalog = JSON.parse(await readFile(join(base, "catalog/asset-library.json"), "utf8"));
    const packs = {};
    for (const pack of catalog.packs || []) {
      if (!APPROVED.has(pack.id)) continue;
      if (pack.license !== "CC0-1.0" || pack.kind !== "sfx")
        throw new Error("Sound pack lacks CC0 approval: " + pack.id);
      if (!pack.source?.startsWith("https://kenney.nl/assets/"))
        throw new Error("Unexpected source: " + pack.id);
      const folder = resolve(base, pack.path);
      const license = resolve(base, pack.licenseFile);
      if (!contained(base,folder) || !contained(base,license))
        throw new Error("Unsafe catalog path: " + pack.id);
      const raw = (await readFile(license, "utf8")).toLowerCase();
      if (!raw.includes("cc0") && !raw.includes("creative commons zero"))
        throw new Error("Missing verified CC0 license text: " + pack.id);
      const files = await enumerate(folder);
      const assets = [];
      for (const absolute of files) {
        const resolved = await realpath(absolute);
        if (!contained(base,resolved) || !(await stat(resolved)).size)
          throw new Error("Unsafe or empty audio asset: " + absolute);
        assets.push({ path: resolved, relativePath: relative(base,resolved).split(sep).join("/"),
          name: absolute.split(sep).at(-1), source: pack.source, license: pack.license });
      }
      if (!assets.length) throw new Error("Local audio pack empty: " + pack.id);
      packs[pack.id] = assets;
    }
    for (const name of APPROVED) if (!packs[name]) throw new Error("Required local sound pack missing: " + name);
    return { packs, counts: Object.fromEntries(Object.entries(packs).map(([k,v]) => [k,v.length])) };
  })();
  bankCache = {root:base,promise};
  return promise;
}

export async function chooseSound({ role, seed, root = ROOT }) {
  const config = SOUND_ROLES[role];
  if (!config) throw new Error("Unknown sound role: " + role);
  const library = await inventorySoundBank(root);
  const all = library.packs[config.pack];
  const preferred = all.filter(item => config.filter.test(item.name));
  // If the upstream pack uses different filenames, retain its approved sounds.
  const choices = preferred.length ? preferred : all;
  const hash = createHash("sha256").update(String(seed) + ":" + role).digest();
  const selection = choices[hash.readUInt32BE(0) % choices.length];
  return { ...selection, role, maxDuration: config.maxDuration, pack: config.pack };
}

export async function chooseMusic({ id, root = ROOT }) {
  const base = resolve(root);
  const catalog = JSON.parse(await readFile(join(base,"catalog/asset-library.json"),"utf8"));
  const music = catalog.music?.find(item => item.id === id && item.license === "CC0-1.0");
  if (!music) throw new Error("Unknown or unapproved music ID: " + id);
  const file = resolve(base,music.path);
  if (!contained(base,file) || !(await stat(file)).size) throw new Error("Missing music asset: " + id);
  const verified = await realpath(file);
  if (!contained(base,verified)) throw new Error("Music path outside repo");
  if (music.sha256) {
    const {createReadStream} = await import("node:fs");
    const {pipeline} = await import("node:stream/promises");
    const {Writable} = await import("node:stream");
    const h = createHash("sha256");
    await pipeline(createReadStream(verified),new Writable({write(chunk,_enc,done){h.update(chunk);done();}}));
    if (h.digest("hex") !== music.sha256) throw new Error("Music checksum mismatch: " + id);
  }
  return { path: verified, license: music.license, source: music.source, author: music.author };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await inventorySoundBank();
  console.log(JSON.stringify({counts:result.counts,total:Object.values(result.counts).reduce((a,b)=>a+b,0),
    roles:Object.keys(SOUND_ROLES),examples:Object.fromEntries(
      await Promise.all(["hook_hit","pop","reveal"].map(async role=>[role,(await chooseSound({role,seed:"sample"})).relativePath]))
    )},null,2));
}
