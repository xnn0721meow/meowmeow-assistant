import { describe, expect, it } from 'vitest'
import { ReminderBudget } from './reminderBudget'

describe('ReminderBudget', () => {
  it('enforces the hourly cap', () => {
    const budget = new ReminderBudget(3, 10 * 60_000)
    expect(budget.consume(0)).toBe(true)
    expect(budget.consume(11 * 60_000)).toBe(true)
    expect(budget.consume(22 * 60_000)).toBe(true)
    expect(budget.consume(23 * 60_000)).toBe(false)
  })

  it('enforces the cooldown', () => {
    const budget = new ReminderBudget(5, 10 * 60_000)
    expect(budget.consume(0)).toBe(true)
    expect(budget.consume(60_000)).toBe(false)
    expect(budget.consume(11 * 60_000)).toBe(true)
  })

  it('expires old reminders after an hour', () => {
    const budget = new ReminderBudget(1, 10 * 60_000)
    expect(budget.consume(0)).toBe(true)
    expect(budget.consume(30 * 60_000)).toBe(false)
    expect(budget.consume(61 * 60_000)).toBe(true)
  })
})
