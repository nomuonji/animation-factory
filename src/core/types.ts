export type ActorArchetype = "salaryman" | "boss";
export type ActorPose = "idle" | "walk-a" | "walk-b" | "surprised" | "dead-inside";
export type Facing = "left" | "right";

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
interface BaseEvent { at: number; }
export interface ActorMoveEvent extends BaseEvent {
  kind: "actor.move"; actor: string; x: number; y: number; duration: number;
}
export interface ActorPoseEvent extends BaseEvent {
  kind: "actor.pose"; actor: string; pose: ActorPose;
}
export interface DialogueSayEvent extends BaseEvent {
  kind: "dialogue.say"; actor: string; text: string; duration: number;
}
export interface CaptionShowEvent extends BaseEvent {
  kind: "ui.caption"; text: string; duration: number;
}
export interface CameraZoomEvent extends BaseEvent {
  kind: "camera.zoom"; zoom: number; duration: number;
}
export interface CameraShakeEvent extends BaseEvent {
  kind: "camera.shake"; intensity?: number; duration: number;
}
export interface DamageEffectEvent extends BaseEvent {
  kind: "effect.damage"; actor: string; text: string; duration?: number;
}
export interface ExclamationEffectEvent extends BaseEvent {
  kind: "effect.exclamation"; actor: string; duration?: number;
}
export type TimelineEvent =
  | ActorMoveEvent
  | ActorPoseEvent
  | DialogueSayEvent
  | CaptionShowEvent
  | CameraZoomEvent
  | CameraShakeEvent
  | DamageEffectEvent
  | ExclamationEffectEvent;

export interface Production {
  meta: ProductionMeta;
  canvas: CanvasConfig;
  environment: string;
  actors: ActorDefinition[];
  events: TimelineEvent[];
}
