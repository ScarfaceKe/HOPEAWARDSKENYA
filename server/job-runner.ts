import { acquireJobLease } from "./job-lease";

/**
 * Adaptive background jobs.
 *
 * This exists because of a Neon compute incident, so the rules are explicit:
 *
 *  - A pass that finds work runs again at `activeDelayMs` (payment recovery
 *    stays a one-minute safety net while an order is open).
 *  - A pass that finds nothing DORMANT when `idleDelayMs` is null: no timer, no
 *    query, nothing that could wake the database until something asks for a
 *    pass again with `wake()`. Neon only scales to zero when nothing queries it
 *    for five minutes, so "poll every minute in case" is not an option.
 *  - A pass can never overlap itself (single flight), and a `wake()` that
 *    arrives mid-pass queues exactly one follow-up.
 *  - Failures back off exponentially instead of hammering a database that is
 *    down, and every pass goes through a short database lease so a second
 *    Render instance cannot run the same job.
 */

export interface JobResult {
  /** True when this pass found something to do and another pass is warranted. */
  work?: boolean;
}

export interface AdaptiveJobOptions {
  name: string;
  /** Delay after a pass that found work. */
  activeDelayMs: number;
  /** Delay after a pass that found nothing. Null = stay dormant until woken. */
  idleDelayMs: number | null;
  /** Cap for the exponential backoff after failures. */
  maxErrorDelayMs?: number;
  /** 0 disables the database lease (used only for pure in-memory work). */
  leaseTtlMs?: number;
  /** Up to this fraction of extra delay, so instances do not sync up. */
  jitterRatio?: number;
}

export class AdaptiveJob {
  readonly name: string;
  private readonly activeDelayMs: number;
  private readonly idleDelayMs: number | null;
  private readonly maxErrorDelayMs: number;
  private readonly leaseTtlMs: number;
  private readonly jitterRatio: number;

  private handler: (() => Promise<JobResult | void>) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextRunAt = 0;
  private running = false;
  private rerun = false;
  private started = false;
  private failures = 0;

  constructor(options: AdaptiveJobOptions) {
    this.name = options.name;
    this.activeDelayMs = options.activeDelayMs;
    this.idleDelayMs = options.idleDelayMs;
    this.maxErrorDelayMs = options.maxErrorDelayMs ?? 10 * 60_000;
    this.leaseTtlMs = options.leaseTtlMs ?? 2 * 60_000;
    this.jitterRatio = options.jitterRatio ?? 0.1;
  }

  setHandler(handler: () => Promise<JobResult | void>): void {
    this.handler = handler;
  }

  /** Starts the loop. Safe to call twice; the second call is ignored. */
  start(initialDelayMs = 0): void {
    if (this.started || !this.handler) return;
    this.started = true;
    this.schedule(initialDelayMs, true);
  }

  stop(): void {
    this.started = false;
    this.clearTimer();
  }

  /**
   * Requests an early pass — a new pending payment, a freshly credited vote.
   * Only ever moves the next pass earlier; a storm of calls cannot reset the
   * timer, and a wake during a running pass becomes one follow-up pass.
   */
  wake(delayMs = 0): void {
    if (!this.started || !this.handler) return;
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.schedule(delayMs > 0 ? delayMs : 250, false);
  }

  /** Runs one pass right now (the scheduler loop continues afterwards). */
  async runNow(): Promise<void> {
    await this.execute();
  }

  /** Test/ops visibility. */
  get scheduledFor(): number | null {
    return this.timer ? this.nextRunAt : null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(delayMs: number, force: boolean): void {
    const delay = Math.max(0, Math.trunc(delayMs));
    const at = Date.now() + delay;
    // Never postpone an already-scheduled earlier pass.
    if (this.timer && !force && at >= this.nextRunAt) return;
    this.clearTimer();
    this.nextRunAt = at;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.execute();
    }, delay);
    this.timer.unref?.();
  }

  private async execute(): Promise<void> {
    if (!this.handler) return;
    if (this.running) {
      this.rerun = true;
      return;
    }

    this.running = true;
    let work = false;
    let failed = false;
    let leasedOut = false;

    try {
      if (this.leaseTtlMs > 0) {
        leasedOut = !(await acquireJobLease(this.name, this.leaseTtlMs));
      }
      if (!leasedOut) {
        const result = await this.handler();
        work = result?.work === true;
        this.failures = 0;
      }
    } catch (err) {
      failed = true;
      this.failures += 1;
      console.error(
        `[job:${this.name}] Pass failed (${this.failures} in a row):`,
        err instanceof Error ? err.message : err,
      );
    }

    this.running = false;

    // `stop()` may have been called while this pass was awaiting the gateway or
    // the database. Re-arming here would resurrect a job the process is trying
    // to shut down (and on a deploy that means a second instance's work).
    if (!this.started) {
      this.rerun = false;
      return;
    }

    if (this.rerun) {
      this.rerun = false;
      this.schedule(1_000, true);
      return;
    }
    if (leasedOut) {
      // Another instance owns this pass; look again on the idle cadence.
      this.scheduleIdle();
      return;
    }
    if (failed) {
      this.schedule(this.errorDelay(), true);
      return;
    }
    if (work) {
      this.schedule(this.withJitter(this.activeDelayMs), true);
      return;
    }
    this.scheduleIdle();
  }

  private scheduleIdle(): void {
    if (this.idleDelayMs === null) {
      // Dormant: no timer at all. Something must call wake().
      this.clearTimer();
      return;
    }
    this.schedule(this.withJitter(this.idleDelayMs), true);
  }

  private errorDelay(): number {
    const exponent = Math.min(Math.max(this.failures - 1, 0), 6);
    return Math.min(this.maxErrorDelayMs, Math.max(1_000, this.activeDelayMs) * 2 ** exponent);
  }

  private withJitter(ms: number): number {
    if (this.jitterRatio <= 0) return ms;
    return Math.trunc(ms + Math.random() * ms * this.jitterRatio);
  }
}

/**
 * Payment recovery. Woken by `storage.createPendingPayment` (a fan just started
 * a payment) and dormant otherwise, so a quiet database gets a real idle gap.
 * The hourly maintenance sweep below is the safety net that finds orders left
 * behind by a restart.
 */
export const paymentRecoveryJob = new AdaptiveJob({
  name: "payment-recovery",
  activeDelayMs: 60_000,
  idleDelayMs: null,
  maxErrorDelayMs: 5 * 60_000,
  leaseTtlMs: 2 * 60_000,
});

/**
 * Reversal re-checks for votes credited in the last hour. Woken by
 * `creditPendingOrder`, so it only runs while votes are actually landing.
 */
export const voteReconcileJob = new AdaptiveJob({
  name: "vote-reconcile",
  activeDelayMs: 3 * 60_000,
  idleDelayMs: null,
  maxErrorDelayMs: 10 * 60_000,
  leaseTtlMs: 5 * 60_000,
});

/**
 * One consolidated hourly sweep: pending-payment safety net, reversal re-check
 * (covers a restart), social poster queue, WhatsApp link sweep, upload cleanup
 * and retention purge. Coalescing them into a single pass matters on Neon: two
 * timers five minutes apart would keep the compute awake all month, while one
 * pass an hour still lets it suspend between sweeps.
 */
export const maintenanceJob = new AdaptiveJob({
  name: "maintenance",
  activeDelayMs: 60 * 60_000,
  idleDelayMs: 60 * 60_000,
  maxErrorDelayMs: 30 * 60_000,
  leaseTtlMs: 10 * 60_000,
});
