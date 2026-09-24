import type { AudioConfig, TtsVoiceProfile } from "./types";

const TTS_PROVIDERS = new Set(["none", "espeak-ng", "piper-plus"]);
const TTS_EVENTS = new Set(["dialogue.say", "ui.speech"]);
const BGM_PRESETS = new Set(["office-night", "retro-drone"]);
const SFX_PRESETS = new Set(["heal", "impact", "coin", "alert"]);

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function volume(label: string, value: unknown): void {
  if (value !== undefined && (!finite(value) || value < 0 || value > 2)) {
    throw new Error(`${label} must be between 0 and 2.`);
  }
}

function voiceProfile(label: string, profile: TtsVoiceProfile | undefined): void {
  if (!profile) return;

  if (
    profile.voice !== undefined &&
    (typeof profile.voice !== "string" || profile.voice.length === 0)
  ) {
    throw new Error(`${label}.voice must be a non-empty string.`);
  }

  if (
    profile.rate !== undefined &&
    (!finite(profile.rate) || profile.rate < 80 || profile.rate > 450)
  ) {
    throw new Error(`${label}.rate must be between 80 and 450.`);
  }

  if (
    profile.pitch !== undefined &&
    (!finite(profile.pitch) || profile.pitch < 0 || profile.pitch > 99)
  ) {
    throw new Error(`${label}.pitch must be between 0 and 99.`);
  }

  volume(`${label}.volume`, profile.volume);
}

export function validateAudioConfig(
  audio: AudioConfig,
  actorIds: Set<string>,
  duration: number
): void {
  volume("audio.masterVolume", audio.masterVolume);

  if (audio.tts) {
    if (!TTS_PROVIDERS.has(audio.tts.provider)) {
      throw new Error(`Unsupported TTS provider "${String(audio.tts.provider)}".`);
    }

    if (
      audio.tts.events !== undefined &&
      (!Array.isArray(audio.tts.events) ||
        audio.tts.events.some((kind) => !TTS_EVENTS.has(kind)))
    ) {
      throw new Error("audio.tts.events contains an unsupported event kind.");
    }

    voiceProfile("audio.tts.defaultVoice", audio.tts.defaultVoice);

    for (const [actor, profile] of Object.entries(audio.tts.actors ?? {})) {
      if (!actorIds.has(actor)) {
        throw new Error(`audio.tts.actors references unknown actor "${actor}".`);
      }
      voiceProfile(`audio.tts.actors.${actor}`, profile);
    }
  }

  const ids = new Set<string>();

  for (const track of audio.bgm ?? []) {
    if (typeof track.id !== "string" || track.id.length === 0 || ids.has(track.id)) {
      throw new Error(`Audio track ids must be unique. Invalid id: ${String(track.id)}`);
    }
    ids.add(track.id);

    if (!BGM_PRESETS.has(track.preset)) {
      throw new Error(`Unsupported BGM preset "${String(track.preset)}".`);
    }

    const at = track.at ?? 0;
    const trackDuration = track.duration ?? duration - at;

    if (!finite(at) || at < 0 || at >= duration) {
      throw new Error(`BGM "${track.id}" has invalid at.`);
    }
    if (
      !finite(trackDuration) ||
      trackDuration <= 0 ||
      at + trackDuration > duration + Number.EPSILON
    ) {
      throw new Error(`BGM "${track.id}" has invalid duration.`);
    }

    volume(`BGM "${track.id}".volume`, track.volume);

    for (const [label, value] of [
      ["fadeIn", track.fadeIn],
      ["fadeOut", track.fadeOut]
    ] as const) {
      if (
        value !== undefined &&
        (!finite(value) || value < 0 || value > trackDuration)
      ) {
        throw new Error(`BGM "${track.id}".${label} is invalid.`);
      }
    }
  }

  for (const track of audio.sfx ?? []) {
    if (typeof track.id !== "string" || track.id.length === 0 || ids.has(track.id)) {
      throw new Error(`Audio track ids must be unique. Invalid id: ${String(track.id)}`);
    }
    ids.add(track.id);

    if (!SFX_PRESETS.has(track.preset)) {
      throw new Error(`Unsupported SFX preset "${String(track.preset)}".`);
    }

    if (!finite(track.at) || track.at < 0 || track.at >= duration) {
      throw new Error(`SFX "${track.id}" has invalid at.`);
    }

    volume(`SFX "${track.id}".volume`, track.volume);
  }
}
