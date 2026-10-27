/** Schedule the bell on the audio clock; a delayed JS tick must not swallow it. */
export class TimerAudio {
  private context: AudioContext | null = null;
  private nodes: OscillatorNode[] = [];
  private deadline: number | null = null;
  private scheduledAt: number | null = null;
  private delivered = false;
  private stalled = false;
  constructor(private createContext: () => AudioContext | null, private now = () => Date.now(), private resumeTimeoutMs = 1500) {}

  private cancelNodes(): void {
    for (const node of this.nodes) { try { node.stop(); node.disconnect(); } catch { /* already ended */ } }
    this.nodes = [];
    this.scheduledAt = null;
  }

  private bell(at: number): OscillatorNode[] {
    const context = this.context;
    if (!context || context.state !== 'running') return [];
    const nodes: OscillatorNode[] = [];
    try {
      for (const offset of [0, 0.25, 0.6, 0.85]) {
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, at + offset);
        gain.gain.exponentialRampToValueAtTime(0.35, at + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + offset + 0.2);
        oscillator.connect(gain).connect(context.destination);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(at + offset);
        oscillator.stop(at + offset + 0.23);
        nodes.push(oscillator);
      }
    } catch { /* the persistent visual completion remains available */ }
    return nodes;
  }

  private schedule = (): void => {
    const context = this.context;
    if (this.deadline == null || this.delivered || !context || context.state !== 'running' || this.scheduledAt != null) return;
    const at = context.currentTime + Math.max(0, this.deadline - this.now()) / 1000;
    const nodes = this.bell(at);
    if (nodes.length) { this.nodes = nodes; this.scheduledAt = at; }
  };

  private onStateChange = (): void => {
    if (this.context?.state !== 'running') this.cancelNodes();
    else { this.schedule(); if (this.deadline != null && this.deadline <= this.now()) this.complete(); }
  };

  /** Invoke directly from a tap, before React effects, to satisfy audio policy. */
  prepare(): Promise<boolean> {
    try {
      if (!this.context || this.context.state === 'closed' || this.stalled) {
        this.cancelNodes();
        this.context?.removeEventListener('statechange', this.onStateChange);
        if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => undefined);
        this.context = this.createContext();
        this.stalled = false;
        this.context?.addEventListener('statechange', this.onStateChange);
      }
      const context = this.context;
      if (!context) return Promise.resolve(false);
      const ready = () => {
        if (this.context !== context) return false;
        this.stalled = false;
        this.schedule();
        if (this.deadline != null && this.deadline <= this.now()) this.complete();
        return context.state === 'running';
      };
      if (context.state === 'running') return Promise.resolve(ready());
      // Some iOS versions leave resume() pending forever. Let the next tap retry
      // with a fresh context, and let the sound-test UI report the failure.
      return new Promise((resolve) => {
        const timeout = setTimeout(() => { if (this.context === context) this.stalled = true; resolve(false); }, this.resumeTimeoutMs);
        context.resume().then(() => { clearTimeout(timeout); resolve(ready()); })
          .catch(() => { clearTimeout(timeout); resolve(false); });
      });
    } catch { return Promise.resolve(false); }
  }

  setDeadline(deadline: number | null): void {
    if (this.deadline === deadline) return;
    this.cancelNodes();
    this.deadline = deadline;
    this.delivered = false;
    this.schedule();
  }

  complete(): void {
    if (this.deadline == null || this.delivered) return;
    const context = this.context;
    if (!context || context.state !== 'running') return; // retry on visibility or next tap
    if (this.scheduledAt != null && context.currentTime >= this.scheduledAt - 0.1) {
      this.delivered = true; // the already scheduled bell owns this completion
      return;
    }
    this.cancelNodes();
    this.nodes = this.bell(context.currentTime);
    this.delivered = this.nodes.length > 0;
  }

  test(): Promise<boolean> {
    return this.prepare().then((ready) => ready && this.bell(this.context!.currentTime).length > 0);
  }

  dispose(): void {
    this.setDeadline(null);
    this.context?.removeEventListener('statechange', this.onStateChange);
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}

export const timerAudio = new TimerAudio(() => {
  const Constructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Constructor ? new Constructor() : null;
});
