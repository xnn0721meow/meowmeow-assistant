/**
 * Keeps the mascot from nagging. A reminder is a scarce resource: a short
 * cooldown plus an hourly cap forces the product to choose its moments.
 */
export class ReminderBudget {
  private timestamps: number[] = []

  constructor(
    private maxPerHour: number,
    private cooldownMs = 10 * 60_000
  ) {}

  setMaxPerHour(maxPerHour: number): void {
    this.maxPerHour = Math.max(0, Math.floor(maxPerHour))
  }

  canConsume(now: number): boolean {
    this.prune(now)
    if (this.maxPerHour <= 0) return false
    const last = this.timestamps.at(-1)
    if (last !== undefined && now - last < this.cooldownMs) return false
    return this.timestamps.length < this.maxPerHour
  }

  consume(now: number): boolean {
    if (!this.canConsume(now)) return false
    this.timestamps.push(now)
    return true
  }

  reset(): void {
    this.timestamps = []
  }

  count(now: number): number {
    this.prune(now)
    return this.timestamps.length
  }

  private prune(now: number): void {
    const cutoff = now - 60 * 60_000
    this.timestamps = this.timestamps.filter((timestamp) => timestamp >= cutoff)
  }
}
