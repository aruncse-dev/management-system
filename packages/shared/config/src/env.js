// Environment variables - customize per deployment
export const env = {
    // API
    API_BASE_URL: typeof window === 'undefined'
        ? process.env.API_URL || 'http://localhost:3001'
        : process.env.REACT_APP_API_URL || 'http://localhost:3001',
    // GAS
    GAS_URL: typeof window === 'undefined'
        ? process.env.GAS_URL || ''
        : window.GAS_URL || '',
    // Auth
    GEMINI_KEY: typeof window === 'undefined'
        ? process.env.GEMINI_KEY || ''
        : window.GEMINI_KEY || '',
    ALLOWED_EMAILS: typeof window === 'undefined'
        ? (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
        : [],
};
//# sourceMappingURL=env.js.map