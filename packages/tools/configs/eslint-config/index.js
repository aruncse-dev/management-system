module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
    'react/jsx-uses-react': 'off',
    'react/react-in-jsx-scope': 'off',
    'no-restricted-imports': ['warn', {
      patterns: ['*.css'],
      message: 'Global CSS must only be imported in _app.tsx. Use CSS Modules or styled-components for component-level styles.'
    }]
  },
};
