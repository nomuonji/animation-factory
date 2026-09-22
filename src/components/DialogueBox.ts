import Phaser from "phaser";

export class DialogueBox {
  private panel?: Phaser.GameObjects.Rectangle;
  private label?: Phaser.GameObjects.Text;
  private hideTimer?: Phaser.Time.TimerEvent;

  constructor(private readonly scene: Phaser.Scene, private readonly width: number, private readonly height: number) {}

  show(text: string, duration: number): void {
    this.hide();
    this.panel = this.scene.add
      .rectangle(this.width / 2, this.height - 58, this.width - 24, 78, 0x080a0f, 0.94)
      .setStrokeStyle(2, 0xf1f1e9)
      .setScrollFactor(0)
      .setDepth(100);
    this.label = this.scene.add
      .text(24, this.height - 82, text, {
        fontFamily: "monospace", fontSize: "12px", color: "#f4f2e8",
        wordWrap: { width: this.width - 48 }, lineSpacing: 4
      })
      .setScrollFactor(0)
      .setDepth(101);
    this.hideTimer = this.scene.time.delayedCall(duration * 1000, () => this.hide());
  }

  hide(): void {
    this.hideTimer?.remove(false);
    this.hideTimer = undefined;
    this.panel?.destroy();
    this.panel = undefined;
    this.label?.destroy();
    this.label = undefined;
  }
}
