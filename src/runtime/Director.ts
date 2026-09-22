import Phaser from "phaser";
import type { Production, TimelineEvent } from "../core/types";
import { showDamage, showExclamation } from "../components/Effects";
import type { PixelActor } from "../components/PixelActor";
import type { DialogueBox } from "../components/DialogueBox";

export class Director {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly production: Production,
    private readonly actors: Map<string, PixelActor>,
    private readonly dialogue: DialogueBox
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
      case "ui.caption": {
        const caption = this.scene.add
          .text(this.production.canvas.width / 2, 36, event.text, {
            fontFamily: "monospace",
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
        this.scene.time.delayedCall(event.duration * 1000, () => caption.destroy());
        break;
      }
      case "camera.zoom":
        this.scene.cameras.main.zoomTo(event.zoom, event.duration * 1000, "Sine.easeInOut");
        break;
      case "camera.shake":
        this.scene.cameras.main.shake(event.duration * 1000, event.intensity ?? 0.015);
        break;
      case "effect.damage":
        showDamage(this.scene, this.actor(event.actor), event.text, event.duration);
        break;
      case "effect.exclamation":
        showExclamation(this.scene, this.actor(event.actor), event.duration);
        break;
    }
  }
}
