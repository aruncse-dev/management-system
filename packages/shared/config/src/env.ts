// Environment variables - customize per deployment
export const env = {
  API_BASE_URL: typeof window === 'undefined'
    ? process.env.API_URL || 'http://localhost:3001'
    : process.env.REACT_APP_API_URL || 'http://localhost:3001',

  // Auth
  GEMINI_KEY: typeof window === 'undefined'
    ? process.env.GEMINI_KEY || ''
    : (window as any).GEMINI_KEY || '',

  ALLOWED_EMAILS: typeof window === 'undefined'
    ? (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    : [],
};
