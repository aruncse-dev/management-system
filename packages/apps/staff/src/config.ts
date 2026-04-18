export const MNS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export const API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_GAS_URL ||
  process.env.GAS_EXEC_URL ||
  process.env.API_URL ||
  process.env.VITE_API_URL ||
  process.env.VITE_GAS_URL ||
  '/gas-proxy'
