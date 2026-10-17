import Phaser from "phaser";
export type ExhibitKind = "gold-seal" | "dogu" | "haniwa";

/** Original, simplified drawings — never traced from copyrighted product photography. */
export function createMuseumExhibit(scene: Phaser.Scene, kind: ExhibitKind): Phaser.GameObjects.Container {
  const display=scene.add.container(135,245).setDepth(110).setScrollFactor(0);
  const g=scene.add.graphics();
  display.add(g);
  g.fillStyle(0x080c19,0.87).fillRoundedRect(-103,-101,206,208,18);
  g.lineStyle(2,0x7284a8,0.7).strokeRoundedRect(-102,-100,204,206,18);
  g.fillStyle(0x243249,0.85).fillEllipse(0,69,150,27);
  g.fillStyle(0x617489,0.95).fillRoundedRect(-85,77,170,13,3);
  g.fillStyle(0x0a0e18).fillRoundedRect(-89,88,178,12,2);
  if (kind==="gold-seal") {
    g.fillStyle(0xfff6a2,0.18).fillCircle(0,-11,68);
    // Three-dimensional stylized seal with gold cube and a small coiled animal knob.
    g.fillStyle(0xb37726).fillPoints([{x:-35,y:-12},{x:23,y:-21},{x:36,y:36},{x:-28,y:45}],true);
    g.fillStyle(0xf7c957).fillPoints([{x:-35,y:-12},{x:14,y:-26},{x:23,y:-21},{x:-28,y:-7}],true);
    g.fillStyle(0xffdc6b).fillRoundedRect(-28,-8,55,53,2);
    g.lineStyle(2,0xf6e18c).strokeRoundedRect(-28,-8,55,53,2);
    g.lineStyle(4,0xb58b33).beginPath().moveTo(-8,-12).lineTo(-9,-34).lineTo(4,-44).lineTo(18,-40).lineTo(26,-29).strokePath();
    g.lineStyle(3,0xf4db80).strokeCircle(3,-40,7);
    g.fillStyle(0x171827).fillCircle(8,-41,1.5);
    for (const [x,y] of [[-21,8],[-4,12],[12,13],[-17,28],[1,28],[17,27]]) {
      g.lineStyle(1,0xa97725).strokeRoundedRect(x,y,8,10,1);
    }
    for (const [x,y] of [[-56,-37],[54,-48],[-52,25],[60,25]]) {
      g.lineStyle(2,0xffd778,0.8).beginPath().moveTo(x-4,y).lineTo(x+4,y).moveTo(x,y-4).lineTo(x,y+4).strokePath();
    }
  } else if(kind==="dogu") {
    // Goggles-eye clay humanoid. This is an abstract illustration of the source theme.
    g.fillStyle(0xc18a64).fillRoundedRect(-29,-56,58,52,17);
    g.fillStyle(0x9a6446).fillRoundedRect(-36,-12,72,75,20);
    g.fillStyle(0xd8a073).fillRoundedRect(-30,-9,60,67,19);
    g.fillStyle(0xbe875c).fillRoundedRect(-62,-5,34,17,7);
    g.fillStyle(0xbe875c).fillRoundedRect(28,-5,34,17,7);
    g.fillStyle(0xc28d65).fillRoundedRect(-32,51,24,28,8);
    g.fillStyle(0xc28d65).fillRoundedRect(8,51,24,28,8);
    g.fillStyle(0xe8bd8d).fillEllipse(-15,-35,30,22).fillEllipse(15,-35,30,22);
    g.fillStyle(0x51362b).fillEllipse(-15,-35,19,12).fillEllipse(15,-35,19,12);
    g.lineStyle(3,0x80563c).strokeCircle(-15,-35,16).strokeCircle(15,-35,16);
    g.lineStyle(2,0x8b5b3b).beginPath().moveTo(-22,6).lineTo(22,6).moveTo(-23,25).lineTo(23,25).moveTo(-15,41).lineTo(15,41).strokePath();
    g.lineStyle(3,0xe1ae83).strokeCircle(0,24,7);
    g.fillStyle(0x51362b).fillCircle(0,-14,3);
  } else {
    // Clay haniwa silhouette, simplified and clearly not a product photo.
    g.fillStyle(0xcd9562).fillEllipse(0,47,57,74);
    g.fillStyle(0xd3a171).fillRoundedRect(-31,-54,62,103,23);
    g.fillStyle(0xe8b487).fillEllipse(0,-58,62,55);
    g.fillStyle(0xcb8f5f).fillRoundedRect(-63,-18,36,21,8);
    g.fillStyle(0xcb8f5f).fillRoundedRect(27,-18,36,21,8);
    g.fillStyle(0x302621).fillCircle(-15,-54,7).fillCircle(15,-54,7);
    g.fillStyle(0x392a20).fillCircle(0,-30,9);
    g.lineStyle(3,0xa7734b).beginPath().moveTo(-20,11).lineTo(20,11).moveTo(-20,26).lineTo(20,26).strokePath();
    g.fillStyle(0xffd88a,0.4).fillCircle(57,-53,8);
  }
  return display;
}
