import Phaser from "phaser";
import type { Production, TimelineEvent } from "../core/types";
import { showDamage, showExclamation } from "../components/Effects";
import type { PixelActor } from "../components/PixelActor";
import type { DialogueBox } from "../components/DialogueBox";
import type { PresentationLayer } from "../components/PresentationLayer";

export class Director {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly production: Production,
    private readonly actors: Map<string, PixelActor>,
    private readonly dialogue: DialogueBox,
    private readonly presentation: PresentationLayer
  ) {}

  start(): void {
    const events = [...this.production.events].sort((a, b) => a.at - b.at);
    for (const event of events) {
      this.scene.time.delayedCall(event.at * 1000, () => this.apply(event));
    }
  }

  private actor(id: string): PixelActor {
    const actor = this.actors.get(id);
    if (!actor) throw new Error(`Unknown actor: ${id}`);
    return actor;
  }

  private animate(
    duration: number,
    update: (progress: number) => void,
    complete?: () => void
  ): void {
    const fps = 30;
    const steps = Math.max(1, Math.ceil(duration * fps));
    let index = 0;

    update(0);

    if (steps > 1) {
      this.scene.time.addEvent({
        delay: 1000 / fps,
        repeat: Math.max(0, steps - 2),
        callback: () => {
          index += 1;
          update(Math.min(1, index / steps));
        }
      });
    }

    this.scene.time.delayedCall(duration * 1000, () => {
      update(1);
      complete?.();
    });
  }

  private apply(event: TimelineEvent): void {
    switch (event.kind) {
      case "actor.move": {
        const actor = this.actor(event.actor);
        let toggle = false;
        actor.setPose("walk-a");
        const walkTimer = this.scene.time.addEvent({
          delay: 140,
          repeat: Math.max(0, Math.ceil((event.duration * 1000) / 140) - 1),
          callback: () => {
            toggle = !toggle;
            actor.setPose(toggle ? "walk-a" : "walk-b");
          }
        });
        this.scene.tweens.add({
          targets: actor,
          x: event.x,
          y: event.y,
          duration: event.duration * 1000,
          ease: "Linear",
          onComplete: () => {
            walkTimer.remove(false);
            actor.setPose("idle");
          }
        });
        break;
      }

      case "actor.pose":
        this.actor(event.actor).setPose(event.pose);
        break;

      case "dialogue.say":
        this.dialogue.show(event.text, event.duration);
        break;

      case "ui.speech": {
        const actor = this.actor(event.actor);
        this.animate(
          event.duration,
          () => this.presentation.setSpeech({ actor, text: event.text }),
          () => this.presentation.setSpeech(null)
        );
        break;
      }

      case "ui.caption": {
        const caption = this.scene.add
          .text(this.production.canvas.width / 2, 36, event.text, {
            fontFamily: '"Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", sans-serif',
            fontSize: "12px",
            color: "#ffffff",
            backgroundColor: "#11141ddd",
            padding: { x: 8, y: 6 },
            align: "center",
            wordWrap: { width: this.production.canvas.width - 32 }
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(120);

        this.scene.time.delayedCall(
          event.duration * 1000,
          () => caption.destroy()
        );
        break;
      }

      case "ui.rpgStatus":
        this.presentation.setRpgStatus(event.title, event.lines);
        this.scene.time.delayedCall(
          event.duration * 1000,
          () => this.presentation.setRpgStatus(null)
        );
        break;

      case "ui.essayCard":
        this.presentation.setEssayCard({
          title: event.title,
          body: event.body,
          kicker: event.kicker,
          accent: event.accent
        });
        this.scene.time.delayedCall(
          event.duration * 1000,
          () => this.presentation.setEssayCard(null)
        );
        break;

      case "camera.zoom":
        this.scene.cameras.main.zoomTo(
          event.zoom,
          event.duration * 1000,
          "Sine.easeInOut"
        );
        break;

      case "camera.pan":
        this.scene.tweens.add({
          targets: this.scene.cameras.main,
          scrollX: event.x,
          scrollY: event.y,
          duration: event.duration * 1000,
          ease: "Sine.easeInOut"
        });
        break;

      case "camera.shake":
        this.scene.cameras.main.shake(
          event.duration * 1000,
          event.intensity ?? 0.015
        );
        break;

      case "effect.damage":
        showDamage(
          this.scene,
          this.actor(event.actor),
          event.text,
          event.duration
        );
        break;

      case "effect.exclamation":
        showExclamation(
          this.scene,
          this.actor(event.actor),
          event.duration
        );
        break;

      case "effect.emote": {
        const actor = this.actor(event.actor);
        this.animate(
          event.duration,
          (progress) =>
            this.presentation.setEmote(actor, event.emote, progress),
          () => this.presentation.setEmote(null, null)
        );
        break;
      }

      case "effect.particles": {
        const actor = this.actor(event.actor);
        this.animate(
          event.duration,
          (progress) =>
            this.presentation.setParticles({
              actor,
              kind: event.particle,
              progress
            }),
          () => this.presentation.setParticles(null)
        );
        break;
      }

      case "effect.screenFlash":
        this.animate(
          event.duration,
          (progress) =>
            this.presentation.setScreenFlash(
              progress,
              event.color,
              event.strength ?? 0.9
            ),
          () => this.presentation.setScreenFlash(null)
        );
        break;

      case "transition.fade":
        this.animate(
          event.duration,
          (progress) =>
            this.presentation.setFade(progress, event.mode, event.color),
          () => {
            if (event.mode === "in") {
              this.presentation.setFade(null);
            } else {
              this.presentation.setFade(1, "out", event.color);
            }
          }
        );
        break;

      case "prop.show":
        this.presentation.setProp({
          kind: event.prop,
          x: event.x,
          y: event.y,
          scale: event.scale ?? 1
        });
        this.scene.time.delayedCall(
          event.duration * 1000,
          () => this.presentation.setProp(null)
        );
        break;
    }
  }
}
