/**
 * WAAPI Promise-based Animation Sequencer (~60 lines, Law 4 compliant)
 * Sequences native Web Animations without any external animation libraries.
 */

export interface SequenceStep {
  target: HTMLElement | SVGElement | null;
  keyframes: Keyframe[] | PropertyIndexedKeyframes;
  options: KeyframeAnimationOptions;
  delayMs?: number;
  onStart?: () => void;
  onComplete?: () => void;
}

export class AnimationSequencer {
  private activeAnimations: Animation[] = [];
  private cancelled = false;

  public async runSequence(steps: SequenceStep[]): Promise<void> {
    this.cancelled = false;
    this.cancelAll();

    for (const step of steps) {
      if (this.cancelled) break;

      if (step.delayMs && step.delayMs > 0) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, step.delayMs);
          if (this.cancelled) clearTimeout(timer);
        });
      }

      if (this.cancelled || !step.target) continue;

      if (step.onStart) {
        step.onStart();
      }

      const anim = step.target.animate(step.keyframes, {
        fill: "forwards",
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        ...step.options,
      });

      this.activeAnimations.push(anim);

      await anim.finished.catch(() => {
        // Handle cancellation gracefully
      });

      if (step.onComplete && !this.cancelled) {
        step.onComplete();
      }
    }
  }

  public cancelAll(): void {
    this.cancelled = true;
    for (const anim of this.activeAnimations) {
      try {
        anim.cancel();
      } catch {
        // no-op
      }
    }
    this.activeAnimations = [];
  }
}
