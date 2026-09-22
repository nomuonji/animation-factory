import Phaser from "phaser";
import type { PixelActor } from "./PixelActor";

export function showDamage(scene: Phaser.Scene, actor: PixelActor, text: string, duration = 0.8): void {
  const label = scene.add
    .text(actor.x, actor.y - 46, text, {
      fontFamily: "monospace",
      fontSize: "14px",
      fontStyle: "bold",
      color: "#ff5964",
      stroke: "#12070a",
      strokeThickness: 3
    })
    .setOrigin(0.5)
    .setDepth(80);

  scene.tweens.add({
    targets: label,
    y: label.y - 26,
    alpha: 0,
    duration: duration * 1000,
    ease: "Quad.easeOut",
    onComplete: () => label.destroy()
  });
}

export function showExclamation(scene: Phaser.Scene, actor: PixelActor, duration = 0.7): void {
  const label = scene.add
    .text(actor.x, actor.y - 52, "!", {
      fontFamily: "monospace",
      fontSize: "22px",
      fontStyle: "bold",
      color: "#ffe268",
      stroke: "#15100a",
      strokeThickness: 3
    })
    .setOrigin(0.5)
    .setDepth(80);

  scene.tweens.add({
    targets: label,
    y: label.y - 10,
    scale: 1.25,
    duration: 120,
    yoyo: true,
    hold: Math.max(0, duration * 1000 - 240),
    onComplete: () => label.destroy()
  });
}
