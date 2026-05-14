const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£', EUR: '€', USD: '$', CHF: 'CHF ', JPY: '¥',
}

const CURRENCY_LABELS: Record<string, string> = {
  GBP: 'British Pound', EUR: 'Euro', USD: 'US Dollar', CHF: 'Swiss Franc', JPY: 'Japanese Yen',
}

export const SUPPORTED_CURRENCIES = ['GBP', 'EUR', 'USD', 'CHF', 'JPY']

export function formatCurrency(amountPence: number, currency = 'GBP'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' '
  if (currency === 'JPY') {
    return `${symbol}${Math.round(amountPence / 100).toLocaleString()}`
  }
  return `${symbol}${(amountPence / 100).toLocaleString()}`
}

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency
}

export function currencyLabel(currency: string): string {
  return CURRENCY_LABELS[currency] ?? currency
}
