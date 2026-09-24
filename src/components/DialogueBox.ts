import Phaser from "phaser";

function wrapDialogueText(text: string, maxChars = 34): string {
  return text
    .split("\n")
    .flatMap((line) => {
      const chars = Array.from(line);
      const rows: string[] = [];
      while (chars.length > maxChars) {
        let cut = maxChars;
        const minCut = Math.floor(maxChars * 0.65);
        for (let index = maxChars; index >= minCut; index -= 1) {
          if (/[、。，．！？!? ]/.test(chars[index - 1] ?? "")) {
            cut = index;
            break;
          }
        }
        rows.push(chars.splice(0, cut).join("").trim());
      }
      if (chars.length || rows.length === 0) rows.push(chars.join("").trim());
      return rows;
    })
    .join("\n");
}

export class DialogueBox {
  private panel?: Phaser.GameObjects.Rectangle;
  private label?: Phaser.GameObjects.Text;
  private hideTimer?: Phaser.Time.TimerEvent;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly width: number,
    private readonly height: number
  ) {}

  set(text: string | null): void {
    this.hideTimer?.remove(false);
    this.hideTimer = undefined;

    if (text === null) {
      this.panel?.setVisible(false);
      this.label?.setVisible(false);
      return;
    }

    this.ensureObjects();
    this.panel?.setVisible(true);
    this.label?.setText(wrapDialogueText(text)).setVisible(true);
  }

  show(text: string, duration: number): void {
    this.set(text);
    this.hideTimer = this.scene.time.delayedCall(duration * 1000, () => this.hide());
  }

  hide(): void {
    this.hideTimer?.remove(false);
    this.hideTimer = undefined;
    this.panel?.setVisible(false);
    this.label?.setVisible(false);
  }

  private ensureObjects(): void {
    if (!this.panel) {
      this.panel = this.scene.add
        .rectangle(this.width / 2, this.height - 42, this.width - 24, 70, 0x080a0f, 0.94)
        .setStrokeStyle(2, 0xf1f1e9)
        .setScrollFactor(0)
        .setDepth(100);
    }

    if (!this.label) {
      this.label = this.scene.add
        .text(24, this.height - 69, "", {
          fontFamily: '"Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", sans-serif',
          fontSize: "12px",
          color: "#f4f2e8",
          wordWrap: { width: this.width - 48 },
          lineSpacing: 4
        })
        .setScrollFactor(0)
        .setDepth(101);
    }
  }
}
