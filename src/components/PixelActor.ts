import Phaser from "phaser";
import type { ActorArchetype, ActorPose, Facing } from "../core/types";
import { PALETTES, PIXEL_FRAMES } from "./pixelFrames";

export class PixelActor extends Phaser.GameObjects.Container {
  readonly actorId: string;
  private readonly archetype: ActorArchetype;
  private readonly unit = 2;
  private pose: ActorPose = "idle";
  private facing: Facing = "right";
  private actorScale = 1;

  constructor(
    scene: Phaser.Scene,
    actorId: string,
    archetype: ActorArchetype,
    x: number,
    y: number,
    scale = 1,
    facing: Facing = "right",
    pose: ActorPose = "idle"
  ) {
    super(scene, x, y);
    this.actorId = actorId;
    this.archetype = archetype;
    this.actorScale = scale;
    this.facing = facing;
    scene.add.existing(this);
    this.setDepth(20);
    this.setPose(pose);
    this.applyFacing();
  }

  setPose(pose: ActorPose): this {
    if (this.pose === pose && this.length > 0) return this;
    this.pose = pose;
    this.removeAll(true);

    const frame = PIXEL_FRAMES[pose];
    const palette = PALETTES[this.archetype];
    const width = Math.max(...frame.map((row) => row.length));
    const height = frame.length;

    frame.forEach((row, rowIndex) => {
      [...row].forEach((token, colIndex) => {
        if (token === ".") return;
        const color = palette[token];
        if (color === undefined) return;
        const x = (colIndex - width / 2 + 0.5) * this.unit;
        const y = (rowIndex - height + 0.5) * this.unit;
        const pixel = this.scene.add.rectangle(x, y, this.unit, this.unit, color).setOrigin(0.5);
        this.add(pixel);
      });
    });

    this.setSize(width * this.unit, height * this.unit);
    return this;
  }

  setFacing(facing: Facing): this {
    this.facing = facing;
    this.applyFacing();
    return this;
  }

  private applyFacing(): void {
    const direction = this.facing === "left" ? -1 : 1;
    this.setScale(direction * this.actorScale, this.actorScale);
  }
}
