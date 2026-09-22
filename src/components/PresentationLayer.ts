import Phaser from "phaser";
import type {
  EmoteKind,
  ParticleKind,
  PropKind
} from "../core/types";
import type { PixelActor } from "./PixelActor";

interface SpeechState {
  actor: PixelActor;
  text: string;
}

interface ParticleState {
  actor: PixelActor;
  kind: ParticleKind;
  progress: number;
}

interface PropState {
  kind: PropKind;
  x: number;
  y: number;
  scale: number;
}

function parseColor(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const normalized = value.startsWith("#") ? value.slice(1) : value;
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class PresentationLayer {
  private readonly speech: Phaser.GameObjects.Container;
  private readonly speechPanel: Phaser.GameObjects.Rectangle;
  private readonly speechText: Phaser.GameObjects.Text;

  private readonly status: Phaser.GameObjects.Container;
  private readonly statusPanel: Phaser.GameObjects.Rectangle;
  private readonly statusTitle: Phaser.GameObjects.Text;
  private readonly statusBody: Phaser.GameObjects.Text;

  private readonly emote: Phaser.GameObjects.Container;
  private readonly particles: Phaser.GameObjects.Container;
  private readonly prop: Phaser.GameObjects.Container;

  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly fade: Phaser.GameObjects.Rectangle;

  constructor(
    private readonly scene: Phaser.Scene,
    width: number,
    height: number
  ) {
    this.speech = scene.add.container(0, 0).setDepth(90).setVisible(false);
    this.speechPanel = scene.add
      .rectangle(0, 0, 128, 48, 0xf5f1e7, 0.98)
      .setStrokeStyle(2, 0x161923);
    this.speechText = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#171923",
        align: "center",
        wordWrap: { width: 112 }
      })
      .setOrigin(0.5);
    this.speech.add([this.speechPanel, this.speechText]);

    this.status = scene.add
      .container(width - 68, 74)
      .setDepth(130)
      .setScrollFactor(0)
      .setVisible(false);
    this.statusPanel = scene.add
      .rectangle(0, 0, 118, 74, 0x090c13, 0.94)
      .setStrokeStyle(2, 0xd9dfeb);
    this.statusTitle = scene.add
      .text(0, -23, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        fontStyle: "bold",
        color: "#f4e18a"
      })
      .setOrigin(0.5);
    this.statusBody = scene.add
      .text(-49, -10, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#edf0f7",
        lineSpacing: 3
      })
      .setOrigin(0, 0);
    this.status.add([this.statusPanel, this.statusTitle, this.statusBody]);

    this.emote = scene.add.container(0, 0).setDepth(85).setVisible(false);
    this.particles = scene.add.container(0, 0).setDepth(75).setVisible(false);
    this.prop = scene.add.container(0, 0).setDepth(45).setVisible(false);

    this.flash = scene.add
      .rectangle(width / 2, height / 2, width, height, 0xffffff, 0)
      .setScrollFactor(0)
      .setDepth(210)
      .setVisible(false);

    this.fade = scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(220)
      .setVisible(false);
  }

  setSpeech(state: SpeechState | null): void {
    if (!state) {
      this.speech.setVisible(false);
      return;
    }

    this.speech
      .setPosition(state.actor.x, state.actor.y - 72)
      .setVisible(true);
    this.speechText.setText(state.text);
  }

  setRpgStatus(title: string | null, lines: string[] = []): void {
    if (!title) {
      this.status.setVisible(false);
      return;
    }

    this.statusTitle.setText(title);
    this.statusBody.setText(lines.join("\n"));
    this.status.setVisible(true);
  }

  setEmote(actor: PixelActor | null, kind: EmoteKind | null, progress = 0): void {
    this.emote.removeAll(true);

    if (!actor || !kind) {
      this.emote.setVisible(false);
      return;
    }

    const bob = Math.sin(progress * Math.PI) * 5;
    this.emote.setPosition(actor.x + 24, actor.y - 56 - bob);

    if (kind === "heart") {
      const color = 0xf0566f;
      const unit = 3;
      const pixels: Array<readonly [number, number]> = [
        [-2, -1], [-1, -2], [0, -1], [1, -2], [2, -1],
        [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
        [-1, 1], [0, 1], [1, 1], [0, 2]
      ];

      for (const [x, y] of pixels) {
        this.emote.add(
          this.scene.add
            .rectangle(x * unit, y * unit, unit, unit, color)
            .setOrigin(0.5)
        );
      }
    } else {
      const color = 0x62bce8;
      this.emote.add([
        this.scene.add.rectangle(0, -5, 4, 4, color),
        this.scene.add.rectangle(-2, -1, 8, 4, color),
        this.scene.add.rectangle(-4, 3, 8, 4, color)
      ]);
    }

    this.emote.setVisible(true);
  }

  setParticles(state: ParticleState | null): void {
    this.particles.removeAll(true);

    if (!state) {
      this.particles.setVisible(false);
      return;
    }

    const palette: Record<ParticleKind, readonly number[]> = {
      spark: [0xffe268, 0xffffff, 0xffb347],
      coin: [0xffd95a, 0xffb82e, 0xffec8a],
      dust: [0xb1a99b, 0x8e877d, 0xc7c0b4]
    };
    const colors = palette[state.kind];
    const originX = state.actor.x;
    const originY = state.actor.y - 20;

    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 + index * 0.19;
      const distance = 8 + 34 * state.progress;
      const x = originX + Math.cos(angle) * distance;
      const y = originY + Math.sin(angle) * distance - 12 * state.progress;
      const alpha = 1 - state.progress;
      const size = state.kind === "coin" ? 4 : 3;
      const color =
        colors[index % colors.length] ??
        colors[0] ??
        0xffffff;

      this.particles.add(
        this.scene.add
          .rectangle(x, y, size, size, color, alpha)
          .setOrigin(0.5)
      );
    }

    this.particles.setVisible(true);
  }

  setScreenFlash(
    progress: number | null,
    color?: string,
    strength = 0.9
  ): void {
    if (progress === null) {
      this.flash.setVisible(false);
      return;
    }

    const alpha = Math.max(0, Math.min(1, strength * (1 - progress)));
    this.flash
      .setFillStyle(parseColor(color, 0xffffff), alpha)
      .setVisible(alpha > 0);
  }

  setFade(
    progress: number | null,
    mode: "in" | "out" = "out",
    color?: string
  ): void {
    if (progress === null) {
      this.fade.setVisible(false);
      return;
    }

    const alpha = mode === "out" ? progress : 1 - progress;
    this.fade
      .setFillStyle(
        parseColor(color, 0x000000),
        Math.max(0, Math.min(1, alpha))
      )
      .setVisible(alpha > 0);
  }

  setProp(state: PropState | null): void {
    this.prop.removeAll(true);

    if (!state) {
      this.prop.setVisible(false);
      return;
    }

    this.prop.setPosition(state.x, state.y).setScale(state.scale);

    if (state.kind === "coffee") {
      this.prop.add([
        this.scene.add
          .rectangle(0, 0, 12, 14, 0xe8e0cf)
          .setStrokeStyle(1, 0x28221e),
        this.scene.add
          .rectangle(7, 0, 4, 8, 0x000000, 0)
          .setStrokeStyle(2, 0xe8e0cf),
        this.scene.add.rectangle(0, -4, 8, 3, 0x5d3420)
      ]);
    } else if (state.kind === "briefcase") {
      this.prop.add([
        this.scene.add
          .rectangle(0, 2, 20, 14, 0x583b2b)
          .setStrokeStyle(1, 0x211711),
        this.scene.add
          .rectangle(0, -7, 8, 4, 0x000000, 0)
          .setStrokeStyle(2, 0x583b2b),
        this.scene.add.rectangle(0, 2, 2, 14, 0xc18b55)
      ]);
    } else {
      this.prop.add([
        this.scene.add
          .rectangle(0, 0, 10, 10, 0xf6c945)
          .setStrokeStyle(2, 0x9a6e13),
        this.scene.add.rectangle(0, 0, 2, 6, 0xffef9d)
      ]);
    }

    this.prop.setVisible(true);
  }
}
