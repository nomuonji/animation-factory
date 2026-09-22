import Phaser from "phaser";

function block(scene: Phaser.Scene, x: number, y: number, width: number, height: number, color: number, depth = 0) {
  return scene.add.rectangle(x, y, width, height, color).setOrigin(0.5).setDepth(depth);
}

export function renderEnvironment(scene: Phaser.Scene, id: string, width: number, height: number): void {
  block(scene, width / 2, height / 2, width, height, 0x0d1120, -20);
  if (id !== "office-night") {
    block(scene, width / 2, height * 0.8, width, height * 0.4, 0x24293a, -10);
    return;
  }

  block(scene, width / 2, height * 0.26, width - 34, height * 0.34, 0x171c2b, -15);
  block(scene, width / 2, height * 0.73, width, height * 0.54, 0x2a2c34, -15);
  for (let i = 0; i < 5; i += 1) {
    block(scene, 47 + i * 44, 105, 28, 72, 0x090b14, -14);
    block(scene, 47 + i * 44, 105, 2, 72, 0x36405b, -13);
  }
  block(scene, 68, 327, 96, 10, 0x76533e, -5);
  block(scene, 68, 356, 8, 48, 0x4d382f, -5);
  block(scene, 121, 356, 8, 48, 0x4d382f, -5);
  block(scene, 55, 308, 36, 24, 0x11151d, -4);
  block(scene, 55, 308, 29, 17, 0x8fb3bd, -3);
  block(scene, 202, 327, 92, 10, 0x76533e, -5);
  block(scene, 173, 356, 8, 48, 0x4d382f, -5);
  block(scene, 226, 356, 8, 48, 0x4d382f, -5);
  block(scene, 204, 307, 38, 25, 0x11151d, -4);
  block(scene, 204, 307, 31, 18, 0xd9b35f, -3);
  block(scene, width / 2, 414, width, 4, 0x181a21, -2);
}
