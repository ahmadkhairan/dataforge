import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const colLetter = (index: number) => {
  let s = ''
  let n = index
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}
export const formatNumber = (value: unknown) =>
  typeof value === 'number' ? new Intl.NumberFormat('id-ID').format(value) : String(value ?? '')
