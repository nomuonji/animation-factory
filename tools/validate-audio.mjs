const TTS_PROVIDERS = new Set(["none", "espeak-ng", "piper-plus"]);
const TTS_EVENTS = new Set(["dialogue.say", "ui.speech"]);
const BGM_PRESETS = new Set(["office-night", "retro-drone"]);
const SFX_PRESETS = new Set(["heal", "impact", "coin", "alert"]);

const finite = (value) => typeof value === "number" && Number.isFinite(value);

function validateVolume(errors, label, value) {
  if (value !== undefined && (!finite(value) || value < 0 || value > 2)) {
    errors.push(`${label} must be between 0 and 2`);
  }
}

function validateVoice(errors, label, profile) {
  if (!profile) return;

  if (
    profile.voice !== undefined &&
    (typeof profile.voice !== "string" || !profile.voice)
  ) {
    errors.push(`${label}.voice must be a non-empty string`);
  }
  if (
    profile.rate !== undefined &&
    (!finite(profile.rate) || profile.rate < 80 || profile.rate > 450)
  ) {
    errors.push(`${label}.rate must be between 80 and 450`);
  }
  if (
    profile.pitch !== undefined &&
    (!finite(profile.pitch) || profile.pitch < 0 || profile.pitch > 99)
  ) {
    errors.push(`${label}.pitch must be between 0 and 99`);
  }
  validateVolume(errors, `${label}.volume`, profile.volume);
}

export function validateAudio(audio, actorIds, duration, errors) {
  if (!audio) return;

  validateVolume(errors, "audio.masterVolume", audio.masterVolume);

  if (audio.tts) {
    if (!TTS_PROVIDERS.has(audio.tts.provider)) {
      errors.push(`unsupported TTS provider: ${audio.tts.provider}`);
    }

    if (
      audio.tts.events !== undefined &&
      (!Array.isArray(audio.tts.events) ||
        audio.tts.events.some((kind) => !TTS_EVENTS.has(kind)))
    ) {
      errors.push("audio.tts.events contains an unsupported event kind");
    }

    validateVoice(errors, "audio.tts.defaultVoice", audio.tts.defaultVoice);

    for (const [actor, profile] of Object.entries(audio.tts.actors ?? {})) {
      if (!actorIds.has(actor)) {
        errors.push(`audio.tts.actors references missing actor: ${actor}`);
      }
      validateVoice(errors, `audio.tts.actors.${actor}`, profile);
    }
  }

  const ids = new Set();

  for (const track of audio.bgm ?? []) {
    if (typeof track.id !== "string" || !track.id || ids.has(track.id)) {
      errors.push(`invalid or duplicate audio track id: ${String(track.id)}`);
    }
    ids.add(track.id);

    if (!BGM_PRESETS.has(track.preset)) {
      errors.push(`unsupported BGM preset: ${track.preset}`);
    }

    const at = track.at ?? 0;
    const trackDuration = track.duration ?? duration - at;

    if (!finite(at) || at < 0 || at >= duration) {
      errors.push(`BGM ${track.id} has invalid at`);
    }
    if (
      !finite(trackDuration) ||
      trackDuration <= 0 ||
      at + trackDuration > duration + Number.EPSILON
    ) {
      errors.push(`BGM ${track.id} has invalid duration`);
    }

    validateVolume(errors, `BGM ${track.id}.volume`, track.volume);

    for (const [label, value] of [
      ["fadeIn", track.fadeIn],
      ["fadeOut", track.fadeOut]
    ]) {
      if (
        value !== undefined &&
        (!finite(value) || value < 0 || value > trackDuration)
      ) {
        errors.push(`BGM ${track.id}.${label} is invalid`);
      }
    }
  }

  for (const track of audio.sfx ?? []) {
    if (typeof track.id !== "string" || !track.id || ids.has(track.id)) {
      errors.push(`invalid or duplicate audio track id: ${String(track.id)}`);
    }
    ids.add(track.id);

    if (!SFX_PRESETS.has(track.preset)) {
      errors.push(`unsupported SFX preset: ${track.preset}`);
    }
    if (!finite(track.at) || track.at < 0 || track.at >= duration) {
      errors.push(`SFX ${track.id} has invalid at`);
    }

    validateVolume(errors, `SFX ${track.id}.volume`, track.volume);
  }
}
