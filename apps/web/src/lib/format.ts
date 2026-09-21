const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function formatMoney(value: number): string {
  return money.format(value)
}

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

export function formatWeight(kg: number | null): string {
  return kg === null ? '—' : `${kg} kg`
}

export function formatShortId(id: string): string {
  return `#${id.slice(-8).toUpperCase()}`
}
