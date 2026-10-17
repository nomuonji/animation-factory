import Phaser from "phaser";

function block(scene: Phaser.Scene, x: number, y: number, width: number, height: number, color: number, depth = 0) {
  return scene.add.rectangle(x, y, width, height, color).setOrigin(0.5).setDepth(depth);
}

export function renderEnvironment(scene: Phaser.Scene, id: string, width: number, height: number): void {
  block(scene, width / 2, height / 2, width, height, 0x0d1120, -20);
  if (id === "museum-gallery") {
    // Purpose-built illustrated gallery background; no photographed artifacts.
    block(scene,width/2,height/2,width,height,0x151c2a,-19);
    block(scene,width/2,171,width-22,287,0x263044,-18);
    block(scene,width/2,407,width,146,0x352d31,-17);
    block(scene,width/2,342,width,4,0xc8a166,-15);
    block(scene,18,188,5,260,0x546078,-14);
    block(scene,width-18,188,5,260,0x546078,-14);
    for (const x of [38,232]) {
      block(scene,x,84,39,65,0x161d2b,-13);
      block(scene,x,84,34,60,0xb49b74,-12);
      block(scene,x,84,28,54,0x303544,-11);
      block(scene,x,143,30,3,0xd7ba79,-11);
    }
    block(scene,135,42,125,6,0xffdc9b,-12);
    block(scene,135,55,182,17,0x182033,-12);
    block(scene,135,58,103,2,0x746b64,-11);
    block(scene,135,399,196,8,0x9f846e,-6);
    block(scene,135,416,184,28,0x47383c,-6);
    return;
  }
  if (id === "office-night-wide") {
    const sx = width / 480;
    const sy = height / 270;
    const tile = (x: number, y: number, w: number, h: number, color: number, depth = -10) =>
      block(scene, x * sx, y * sy, w * sx, h * sy, color, depth);

    tile(240, 76, 454, 136, 0x1a2030, -18);
    tile(240, 210, 480, 120, 0x292b34, -17);
    for (let index = 0; index < 6; index += 1) {
      const x = 55 + index * 74;
      tile(x, 73, 54, 82, 0x090d19, -16);
      tile(x, 73, 2, 82, 0x415071, -15);
      tile(x + 15, 95, 8, 18, 0x16233b, -15);
      tile(x - 16, 100, 5, 9, 0x2e3c50, -15);
    }
    for (const x of [118, 362]) {
      tile(x, 171, 170, 8, 0x76533e, -7);
      tile(x - 68, 193, 7, 39, 0x4d382f, -7);
      tile(x + 68, 193, 7, 39, 0x4d382f, -7);
      tile(x - 27, 154, 45, 28, 0x11151d, -6);
      tile(x - 27, 154, 37, 20, 0x8fb3bd, -5);
    }
    tile(240, 238, 480, 4, 0x171a24, -2);
    return;
  }
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
