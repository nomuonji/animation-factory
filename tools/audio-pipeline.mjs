import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function ensureCommand(command, label) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, ["--version"], { stdio: "ignore" });
    child.on("error", () =>
      reject(new Error(`${label} is required but "${command}" was not found on PATH.`))
    );
    child.on("exit", (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`${label} is required but "${command}" is unavailable.`))
    );
  });
}

function bgmGraph(preset, duration) {
  const d = Math.max(0.1, duration);

  switch (preset) {
    case "office-night":
      return [
        `sine=frequency=110:sample_rate=48000:duration=${d}[a]`,
        `sine=frequency=165:sample_rate=48000:duration=${d}[b]`,
        `anoisesrc=color=pink:amplitude=0.01:sample_rate=48000:duration=${d}[n]`,
        "[n]lowpass=f=450[nf]",
        "[a][b][nf]amix=inputs=3:normalize=0,volume=0.14"
      ].join(";");

    case "retro-drone":
      return [
        `sine=frequency=82.41:sample_rate=48000:duration=${d}[a]`,
        `sine=frequency=123.47:sample_rate=48000:duration=${d}[b]`,
        "[a]lowpass=f=500[a1]",
        "[b]lowpass=f=700[b1]",
        "[a1][b1]amix=inputs=2:normalize=0,volume=0.12"
      ].join(";");

    default:
      throw new Error(`Unknown BGM preset: ${preset}`);
  }
}

function sfxGraph(preset) {
  switch (preset) {
    case "heal":
      return [
        "sine=frequency=660:sample_rate=48000:duration=0.32[a]",
        "sine=frequency=880:sample_rate=48000:duration=0.20[b]",
        "[b]adelay=110|110[b1]",
        "[a][b1]amix=inputs=2:normalize=0,volume=0.35,afade=t=out:st=0.18:d=0.14"
      ].join(";");

    case "impact":
      return "anoisesrc=color=white:amplitude=0.4:sample_rate=48000:duration=0.24,lowpass=f=650,volume=0.65,afade=t=out:st=0.04:d=0.20";

    case "coin":
      return [
        "sine=frequency=1200:sample_rate=48000:duration=0.22[a]",
        "sine=frequency=1600:sample_rate=48000:duration=0.16[b]",
        "[b]adelay=90|90[b1]",
        "[a][b1]amix=inputs=2:normalize=0,volume=0.30,afade=t=out:st=0.10:d=0.12"
      ].join(";");

    case "alert":
      return [
        "sine=frequency=440:sample_rate=48000:duration=0.18[a]",
        "sine=frequency=660:sample_rate=48000:duration=0.18[b]",
        "[b]adelay=180|180[b1]",
        "[a][b1]amix=inputs=2:normalize=0,volume=0.28,afade=t=out:st=0.24:d=0.12"
      ].join(";");

    default:
      throw new Error(`Unknown SFX preset: ${preset}`);
  }
}

function actorVoice(config, actor) {
  const base = config.defaultVoice ?? {};
  const override = config.actors?.[actor] ?? {};
  return { ...base, ...override };
}

async function fetchJson(url, options, label) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${label} failed: ${response.status} ${response.statusText}`);
  return response.json();
}

let voicevoxSpeakers;

async function resolveVoicevoxStyle(baseUrl, profile) {
  const rawVoice = profile.voice ?? "男声2";
  if (/^\d+$/.test(rawVoice)) return Number(rawVoice);
  voicevoxSpeakers ??= await fetchJson(`${baseUrl}/speakers`, undefined, "VOICEVOX /speakers");
  const speaker = voicevoxSpeakers.find((item) => item.name === rawVoice);
  if (!speaker) throw new Error(`VOICEVOX speaker "${rawVoice}" was not found.`);
  const styleName = profile.style ?? "ノーマル";
  const style = speaker.styles.find((item) => item.name === styleName) ?? speaker.styles[0];
  if (!style) throw new Error(`VOICEVOX speaker "${rawVoice}" has no styles.`);
  return style.id;
}

async function renderVoicevox({ text, profile, output }) {
  const baseUrl = process.env.VOICEVOX_URL ?? "http://127.0.0.1:50021";
  const speaker = await resolveVoicevoxStyle(baseUrl, profile);
  const queryUrl = new URL(`${baseUrl}/audio_query`);
  queryUrl.searchParams.set("speaker", String(speaker));
  queryUrl.searchParams.set("text", text);
  const query = await fetchJson(queryUrl, { method: "POST" }, "VOICEVOX /audio_query");
  query.speedScale = profile.speedScale ?? Math.max(0.75, Math.min(1.35, (profile.rate ?? 175) / 175));
  query.intonationScale = profile.intonationScale ?? 1;
  query.pitchScale = 0;
  query.volumeScale = 1;
  query.prePhonemeLength = Math.max(query.prePhonemeLength ?? 0.1, 0.08);
  query.postPhonemeLength = Math.max(query.postPhonemeLength ?? 0.1, 0.12);
  query.outputSamplingRate = 48000;
  query.outputStereo = false;
  const synthesisUrl = new URL(`${baseUrl}/synthesis`);
  synthesisUrl.searchParams.set("speaker", String(speaker));
  const response = await fetch(synthesisUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query)
  });
  if (!response.ok) throw new Error(`VOICEVOX /synthesis failed: ${response.status} ${response.statusText}`);
  await writeFile(output, Buffer.from(await response.arrayBuffer()));
}

async function renderTtsTracks({
  production,
  audioDir,
  espeakCommand,
  piperPythonCommand,
  tracks
}) {
  const config = production.audio?.tts;
  if (!config || config.provider === "none") return;

  if (!["espeak-ng", "piper-plus", "voicevox", "voicevox-nemo"].includes(config.provider)) {
    throw new Error(`Unsupported TTS provider: ${config.provider}`);
  }

  if (config.provider === "espeak-ng") {
    await ensureCommand(espeakCommand, "espeak-ng");
  } else if (config.provider === "piper-plus") {
    await ensureCommand(piperPythonCommand, "Python for Piper Plus");
  } else {
    const baseUrl = process.env.VOICEVOX_URL ?? "http://127.0.0.1:50021";
    const response = await fetch(`${baseUrl}/version`);
    if (!response.ok) throw new Error("VOICEVOX Engine is not reachable.");
  }

  const eventKinds = new Set(config.events ?? ["dialogue.say", "ui.speech"]);
  let index = 0;

  for (const event of production.events) {
    if (!eventKinds.has(event.kind)) continue;
    if (!("actor" in event) || !("text" in event)) continue;

    const profile = actorVoice(config, event.actor);
    const output = join(audioDir, `tts-${String(index).padStart(3, "0")}.wav`);
    const spokenText =
      typeof event.spokenText === "string" && event.spokenText.length > 0
        ? event.spokenText
        : event.text;

    if (config.provider === "voicevox" || config.provider === "voicevox-nemo") {
      await renderVoicevox({ text: spokenText, profile, output });
    } else if (config.provider === "piper-plus") {
      const speakingRate = profile.rate ?? 175;
      const lengthScale = Math.max(0.55, Math.min(2.2, 175 / speakingRate));
      const voice = profile.voice ?? "tsukuyomi";
      const model =
        voice === "tsukuyomi"
          ? join(process.cwd(), "tsukuyomi-chan-6lang-fp16.onnx")
          : voice;
      const configPath =
        voice === "tsukuyomi"
          ? join(process.cwd(), "config.json")
          : undefined;

      await run(piperPythonCommand, [
        "-m",
        "piper",
        "--model",
        model,
        ...(configPath ? ["--config", configPath] : []),
        "--length-scale",
        String(lengthScale),
        "--noise-scale",
        "0.5",
        "-f",
        output,
        spokenText
      ]);
    } else {
      const args = [
        "-v",
        profile.voice ?? "en",
        "-s",
        String(profile.rate ?? 175),
        "-p",
        String(profile.pitch ?? 50),
        "-w",
        output,
        spokenText
      ];
      await run(espeakCommand, args);
    }
    tracks.push({
      path: output,
      at: event.at,
      volume: profile.volume ?? 1
    });
    index += 1;
  }
}

async function renderBgmTracks({
  production,
  audioDir,
  ffmpegCommand,
  tracks
}) {
  for (const [index, track] of (production.audio?.bgm ?? []).entries()) {
    const duration =
      track.duration ??
      Math.max(0.1, production.meta.duration - (track.at ?? 0));
    const output = join(audioDir, `bgm-${String(index).padStart(3, "0")}.wav`);
    const graph = bgmGraph(track.preset, duration);

    const filters = [];
    if ((track.fadeIn ?? 0) > 0) {
      filters.push(`afade=t=in:st=0:d=${track.fadeIn}`);
    }
    if ((track.fadeOut ?? 0) > 0) {
      const start = Math.max(0, duration - track.fadeOut);
      filters.push(`afade=t=out:st=${start}:d=${track.fadeOut}`);
    }

    const filter = filters.length > 0
      ? `${graph},${filters.join(",")}`
      : graph;

    await run(ffmpegCommand, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      filter,
      "-c:a",
      "pcm_s16le",
      output
    ]);

    tracks.push({
      path: output,
      at: track.at ?? 0,
      volume: track.volume ?? 0.2
    });
  }
}

async function renderSfxTracks({
  production,
  audioDir,
  ffmpegCommand,
  tracks
}) {
  for (const [index, track] of (production.audio?.sfx ?? []).entries()) {
    const output = join(audioDir, `sfx-${String(index).padStart(3, "0")}.wav`);

    await run(ffmpegCommand, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      sfxGraph(track.preset),
      "-c:a",
      "pcm_s16le",
      output
    ]);

    tracks.push({
      path: output,
      at: track.at,
      volume: track.volume ?? 1
    });
  }
}

async function mixTracks({
  tracks,
  duration,
  masterVolume,
  output,
  ffmpegCommand
}) {
  if (tracks.length === 0) return null;

  const args = ["-hide_banner", "-loglevel", "error", "-y"];

  for (const track of tracks) {
    args.push("-i", track.path);
  }

  const filters = [];
  const labels = [];

  tracks.forEach((track, index) => {
    const label = `a${index}`;
    const delayMs = Math.max(0, Math.round(track.at * 1000));
    filters.push(
      `[${index}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${track.volume},adelay=${delayMs}|${delayMs}[${label}]`
    );
    labels.push(`[${label}]`);
  });

  filters.push(
    `${labels.join("")}amix=inputs=${tracks.length}:duration=longest:normalize=0,atrim=0:${duration},volume=${masterVolume},alimiter=limit=0.95[mix]`
  );

  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[mix]",
    "-ar",
    "48000",
    "-c:a",
    "pcm_s16le",
    output
  );

  await run(ffmpegCommand, args);
  return output;
}

export async function buildAudio({
  production,
  cacheDir,
  ffmpegCommand = "ffmpeg",
  espeakCommand = "espeak-ng",
  piperPythonCommand = process.platform === "win32" ? "python" : "python3"
}) {
  if (!production.audio) return null;

  const audioDir = join(cacheDir, "audio");
  await mkdir(audioDir, { recursive: true });

  const tracks = [];

  await renderTtsTracks({
    production,
    audioDir,
    espeakCommand,
    piperPythonCommand,
    tracks
  });

  await renderBgmTracks({
    production,
    audioDir,
    ffmpegCommand,
    tracks
  });

  await renderSfxTracks({
    production,
    audioDir,
    ffmpegCommand,
    tracks
  });

  return mixTracks({
    tracks,
    duration: production.meta.duration,
    masterVolume: production.audio.masterVolume ?? 1,
    output: join(audioDir, "mix.wav"),
    ffmpegCommand
  });
}
