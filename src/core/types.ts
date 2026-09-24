export type ActorArchetype = "salaryman" | "boss" | "robot";
export type ActorPose = "idle" | "walk-a" | "walk-b" | "surprised" | "dead-inside";
export type Facing = "left" | "right";
export type EmoteKind = "sweat" | "heart";
export type ParticleKind = "spark" | "coin" | "dust";
export type PropKind = "coffee" | "briefcase" | "coin";
export type FadeMode = "in" | "out";

export interface CanvasConfig {
  width: number;
  height: number;
  fps: number;
  outputScale: number;
}

export interface ProductionMeta {
  id: string;
  title: string;
  duration: number;
  description?: string;
}

export interface ActorDefinition {
  id: string;
  archetype: ActorArchetype;
  x: number;
  y: number;
  scale?: number;
  facing?: Facing;
  pose?: ActorPose;
}

interface BaseEvent {
  at: number;
}

export interface ActorMoveEvent extends BaseEvent {
  kind: "actor.move";
  actor: string;
  x: number;
  y: number;
  duration: number;
}

export interface ActorPoseEvent extends BaseEvent {
  kind: "actor.pose";
  actor: string;
  pose: ActorPose;
}

export interface DialogueSayEvent extends BaseEvent {
  kind: "dialogue.say";
  actor: string;
  text: string;
  duration: number;
}

export interface SpeechBubbleEvent extends BaseEvent {
  kind: "ui.speech";
  actor: string;
  text: string;
  duration: number;
}

export interface CaptionShowEvent extends BaseEvent {
  kind: "ui.caption";
  text: string;
  duration: number;
}

export interface RpgStatusEvent extends BaseEvent {
  kind: "ui.rpgStatus";
  title: string;
  lines: string[];
  duration: number;
}

export interface CameraZoomEvent extends BaseEvent {
  kind: "camera.zoom";
  zoom: number;
  duration: number;
}

export interface CameraPanEvent extends BaseEvent {
  kind: "camera.pan";
  x: number;
  y: number;
  duration: number;
}

export interface CameraShakeEvent extends BaseEvent {
  kind: "camera.shake";
  intensity?: number;
  duration: number;
}

export interface DamageEffectEvent extends BaseEvent {
  kind: "effect.damage";
  actor: string;
  text: string;
  duration?: number;
}

export interface ExclamationEffectEvent extends BaseEvent {
  kind: "effect.exclamation";
  actor: string;
  duration?: number;
}

export interface EmoteEffectEvent extends BaseEvent {
  kind: "effect.emote";
  actor: string;
  emote: EmoteKind;
  duration: number;
}

export interface ParticleEffectEvent extends BaseEvent {
  kind: "effect.particles";
  actor: string;
  particle: ParticleKind;
  duration: number;
}

export interface ScreenFlashEvent extends BaseEvent {
  kind: "effect.screenFlash";
  duration: number;
  color?: string;
  strength?: number;
}

export interface FadeTransitionEvent extends BaseEvent {
  kind: "transition.fade";
  mode: FadeMode;
  duration: number;
  color?: string;
}

export interface PropShowEvent extends BaseEvent {
  kind: "prop.show";
  prop: PropKind;
  x: number;
  y: number;
  duration: number;
  scale?: number;
}

export type TimelineEvent =
  | ActorMoveEvent
  | ActorPoseEvent
  | DialogueSayEvent
  | SpeechBubbleEvent
  | CaptionShowEvent
  | RpgStatusEvent
  | CameraZoomEvent
  | CameraPanEvent
  | CameraShakeEvent
  | DamageEffectEvent
  | ExclamationEffectEvent
  | EmoteEffectEvent
  | ParticleEffectEvent
  | ScreenFlashEvent
  | FadeTransitionEvent
  | PropShowEvent;

export type TtsEventKind = "dialogue.say" | "ui.speech";
export type TtsProvider = "none" | "espeak-ng";
export type BgmPreset = "office-night" | "retro-drone";
export type SfxPreset = "heal" | "impact" | "coin" | "alert";

export interface TtsVoiceProfile {
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface TtsConfig {
  provider: TtsProvider;
  events?: TtsEventKind[];
  defaultVoice?: TtsVoiceProfile;
  actors?: Record<string, TtsVoiceProfile>;
}

export interface BgmTrack {
  id: string;
  preset: BgmPreset;
  at?: number;
  duration?: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface SfxTrack {
  id: string;
  preset: SfxPreset;
  at: number;
  volume?: number;
}

export interface AudioConfig {
  masterVolume?: number;
  tts?: TtsConfig;
  bgm?: BgmTrack[];
  sfx?: SfxTrack[];
}

export interface Production {
  meta: ProductionMeta;
  canvas: CanvasConfig;
  environment: string;
  actors: ActorDefinition[];
  events: TimelineEvent[];
  audio?: AudioConfig;
}
