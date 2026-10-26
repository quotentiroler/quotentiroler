const DAY_MS = 24 * 60 * 60 * 1000

export const isoDay = (date) => date.toISOString().slice(0, 10)

export function trailingWindow(days, now = new Date()) {
  return { from: new Date(now.getTime() - days * DAY_MS).toISOString(), to: now.toISOString() }
}

export function completedDaysWindow(days, now = new Date()) {
  const end = new Date(now.getTime() - DAY_MS)
  return { start: isoDay(new Date(end.getTime() - (days - 1) * DAY_MS)), end: isoDay(end) }
}
