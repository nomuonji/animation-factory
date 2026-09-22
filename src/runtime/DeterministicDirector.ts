import Phaser from "phaser";
import type {
  ActorDefinition,
  ActorPose,
  EmoteKind,
  FadeMode,
  Facing,
  ParticleKind,
  Production,
  PropKind,
  TimelineEvent
} from "../core/types";
import type { PixelActor } from "../components/PixelActor";
import type { DialogueBox } from "../components/DialogueBox";
import type { PresentationLayer } from "../components/PresentationLayer";

interface ActorState {
  x: number;
  y: number;
  pose: ActorPose;
  facing: Facing;
}

interface TimedActorEffect {
  actor: string;
  text?: string;
  progress: number;
}

interface EmoteState {
  actor: string;
  kind: EmoteKind;
  progress: number;
}

interface ParticleState {
  actor: string;
  kind: ParticleKind;
  progress: number;
}

interface FlashState {
  progress: number;
  color?: string;
  strength: number;
}

interface FadeState {
  progress: number;
  mode: FadeMode;
  color?: string;
}

interface PropState {
  kind: PropKind;
  x: number;
  y: number;
  scale: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
const easeSineInOut = (progress: number) => -(Math.cos(Math.PI * progress) - 1) / 2;

export class DeterministicDirector {
  private readonly events: TimelineEvent[];
  private readonly definitions = new Map<string, ActorDefinition>();
  private readonly caption: Phaser.GameObjects.Text;
  private readonly damage: Phaser.GameObjects.Text;
  private readonly exclamation: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly production: Production,
    private readonly actors: Map<string, PixelActor>,
    private readonly dialogue: DialogueBox,
    private readonly presentation: PresentationLayer
  ) {
    this.events = [...production.events].sort((a, b) => a.at - b.at);
    for (const definition of production.actors) {
      this.definitions.set(definition.id, definition);
    }

    this.caption = scene.add
      .text(production.canvas.width / 2, 36, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#11141ddd",
        padding: { x: 8, y: 6 },
        align: "center",
        wordWrap: { width: production.canvas.width - 32 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(120)
      .setVisible(false);

    this.damage = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ff5964",
        stroke: "#12070a",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(80)
      .setVisible(false);

    this.exclamation = scene.add
      .text(0, 0, "!", {
        fontFamily: "monospace",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#ffe268",
        stroke: "#15100a",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(80)
      .setVisible(false);
  }

  renderAt(inputTime: number): void {
    const time = Math.max(0, Math.min(this.production.meta.duration, inputTime));
    const states = this.initialActorStates();

    let dialogueText: string | null = null;
    let speechState: { actor: string; text: string } | null = null;
    let captionText: string | null = null;
    let statusState: { title: string; lines: string[] } | null = null;

    let cameraZoom = 1;
    let cameraScrollX = 0;
    let cameraScrollY = 0;

    let damageEffect: TimedActorEffect | null = null;
    let exclamationEffect: TimedActorEffect | null = null;
    let emoteState: EmoteState | null = null;
    let particleState: ParticleState | null = null;
    let flashState: FlashState | null = null;
    let fadeState: FadeState | null = null;
    let propState: PropState | null = null;

    for (const event of this.events) {
      if (event.at > time) break;

      switch (event.kind) {
        case "actor.move": {
          const state = states.get(event.actor);
          if (!state) break;

          const startX = state.x;
          const startY = state.y;
          const progress = clamp01((time - event.at) / event.duration);

          state.x = lerp(startX, event.x, progress);
          state.y = lerp(startY, event.y, progress);

          if (progress < 1) {
            const walkFrame = Math.floor((time - event.at) / 0.14) % 2;
            state.pose = walkFrame === 0 ? "walk-a" : "walk-b";
          } else {
            state.pose = "idle";
          }
          break;
        }

        case "actor.pose": {
          const state = states.get(event.actor);
          if (state) state.pose = event.pose;
          break;
        }

        case "dialogue.say":
          if (time < event.at + event.duration) dialogueText = event.text;
          break;

        case "ui.speech":
          if (time < event.at + event.duration) {
            speechState = { actor: event.actor, text: event.text };
          }
          break;

        case "ui.caption":
          if (time < event.at + event.duration) captionText = event.text;
          break;

        case "ui.rpgStatus":
          if (time < event.at + event.duration) {
            statusState = { title: event.title, lines: event.lines };
          }
          break;

        case "camera.zoom": {
          const progress = easeSineInOut(
            clamp01((time - event.at) / event.duration)
          );
          cameraZoom = lerp(cameraZoom, event.zoom, progress);
          break;
        }

        case "camera.pan": {
          const progress = easeSineInOut(
            clamp01((time - event.at) / event.duration)
          );
          cameraScrollX = lerp(cameraScrollX, event.x, progress);
          cameraScrollY = lerp(cameraScrollY, event.y, progress);
          break;
        }

        case "camera.shake": {
          if (time < event.at + event.duration) {
            const elapsed = time - event.at;
            const normalized = clamp01(elapsed / event.duration);
            const envelope = 1 - normalized;
            const amplitude = Math.max(
              1,
              Math.round((event.intensity ?? 0.015) * this.production.canvas.width)
            );
            cameraScrollX += Math.sin(elapsed * 91) * amplitude * envelope;
            cameraScrollY += Math.cos(elapsed * 73) * amplitude * envelope;
          }
          break;
        }

        case "effect.damage": {
          const duration = event.duration ?? 0.8;
          if (time < event.at + duration) {
            damageEffect = {
              actor: event.actor,
              text: event.text,
              progress: clamp01((time - event.at) / duration)
            };
          }
          break;
        }

        case "effect.exclamation": {
          const duration = event.duration ?? 0.7;
          if (time < event.at + duration) {
            exclamationEffect = {
              actor: event.actor,
              progress: clamp01((time - event.at) / duration)
            };
          }
          break;
        }

        case "effect.emote":
          if (time < event.at + event.duration) {
            emoteState = {
              actor: event.actor,
              kind: event.emote,
              progress: clamp01((time - event.at) / event.duration)
            };
          }
          break;

        case "effect.particles":
          if (time < event.at + event.duration) {
            particleState = {
              actor: event.actor,
              kind: event.particle,
              progress: clamp01((time - event.at) / event.duration)
            };
          }
          break;

        case "effect.screenFlash":
          if (time < event.at + event.duration) {
            flashState = {
              progress: clamp01((time - event.at) / event.duration),
              color: event.color,
              strength: event.strength ?? 0.9
            };
          }
          break;

        case "transition.fade":
          fadeState = {
            progress: clamp01((time - event.at) / event.duration),
            mode: event.mode,
            color: event.color
          };
          break;

        case "prop.show":
          if (time < event.at + event.duration) {
            propState = {
              kind: event.prop,
              x: event.x,
              y: event.y,
              scale: event.scale ?? 1
            };
          }
          break;
      }
    }

    for (const [id, state] of states) {
      const actor = this.actors.get(id);
      if (!actor) continue;
      actor.setPosition(state.x, state.y);
      actor.setFacing(state.facing);
      actor.setPose(state.pose);
    }

    const camera = this.scene.cameras.main;
    camera.setZoom(cameraZoom);
    camera.setScroll(cameraScrollX, cameraScrollY);

    this.dialogue.set(dialogueText);

    if (captionText) {
      this.caption.setText(captionText).setVisible(true);
    } else {
      this.caption.setVisible(false);
    }

    if (speechState) {
      const actor = this.actors.get(speechState.actor) ?? null;
      this.presentation.setSpeech(
        actor ? { actor, text: speechState.text } : null
      );
    } else {
      this.presentation.setSpeech(null);
    }

    this.presentation.setRpgStatus(
      statusState?.title ?? null,
      statusState?.lines ?? []
    );

    if (emoteState) {
      const actor = this.actors.get(emoteState.actor) ?? null;
      this.presentation.setEmote(actor, emoteState.kind, emoteState.progress);
    } else {
      this.presentation.setEmote(null, null);
    }

    if (particleState) {
      const actor = this.actors.get(particleState.actor) ?? null;
      this.presentation.setParticles(
        actor
          ? {
              actor,
              kind: particleState.kind,
              progress: particleState.progress
            }
          : null
      );
    } else {
      this.presentation.setParticles(null);
    }

    if (flashState) {
      this.presentation.setScreenFlash(
        flashState.progress,
        flashState.color,
        flashState.strength
      );
    } else {
      this.presentation.setScreenFlash(null);
    }

    if (fadeState) {
      this.presentation.setFade(
        fadeState.progress,
        fadeState.mode,
        fadeState.color
      );
    } else {
      this.presentation.setFade(null);
    }

    this.presentation.setProp(propState);

    this.renderDamage(damageEffect);
    this.renderExclamation(exclamationEffect);
  }

  private initialActorStates(): Map<string, ActorState> {
    const states = new Map<string, ActorState>();
    for (const [id, definition] of this.definitions) {
      states.set(id, {
        x: definition.x,
        y: definition.y,
        pose: definition.pose ?? "idle",
        facing: definition.facing ?? "right"
      });
    }
    return states;
  }

  private renderDamage(effect: TimedActorEffect | null): void {
    if (!effect) {
      this.damage.setVisible(false);
      return;
    }

    const actor = this.actors.get(effect.actor);
    if (!actor) {
      this.damage.setVisible(false);
      return;
    }

    const rise = 26 * effect.progress;
    this.damage
      .setText(effect.text ?? "")
      .setPosition(actor.x, actor.y - 46 - rise)
      .setAlpha(1 - effect.progress)
      .setVisible(true);
  }

  private renderExclamation(effect: TimedActorEffect | null): void {
    if (!effect) {
      this.exclamation.setVisible(false);
      return;
    }

    const actor = this.actors.get(effect.actor);
    if (!actor) {
      this.exclamation.setVisible(false);
      return;
    }

    const pulse = 1 + Math.sin(effect.progress * Math.PI) * 0.25;
    this.exclamation
      .setPosition(actor.x, actor.y - 52 - 10 * effect.progress)
      .setScale(pulse)
      .setVisible(true);
  }
}
