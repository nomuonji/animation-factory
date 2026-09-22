import Phaser from "phaser";
import type { Production } from "../core/types";
import { DialogueBox } from "../components/DialogueBox";
import { renderEnvironment } from "../components/Environment";
import { PixelActor } from "../components/PixelActor";
import { Director } from "./Director";

export class FactoryScene extends Phaser.Scene {
  private readonly actors = new Map<string, PixelActor>();

  constructor(private readonly production: Production) {
    super({ key: "factory" });
  }

  create(): void {
    this.actors.clear();
    const { width, height } = this.production.canvas;
    this.cameras.main.setBackgroundColor(0x0d1120);
    this.cameras.main.setRoundPixels(true);

    renderEnvironment(this, this.production.environment, width, height);

    for (const definition of this.production.actors) {
      const actor = new PixelActor(
        this,
        definition.id,
        definition.archetype,
        definition.x,
        definition.y,
        definition.scale ?? 1,
        definition.facing ?? "right",
        definition.pose ?? "idle"
      );
      this.actors.set(definition.id, actor);
    }

    const dialogue = new DialogueBox(this, width, height);
    new Director(this, this.production, this.actors, dialogue).start();
  }
}
