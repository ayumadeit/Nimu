const c = n => `rgb(var(--${n}) / <alpha-value>)`
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { canvas: c('bg'), surface: c('surface'), primary: c('primary'), secondary: c('secondary'), accent: c('accent'), ink: c('text'), line: c('border') },
    fontFamily: { sans: ['Nunito', 'DM Sans', 'system-ui', 'sans-serif'], hand: ['Caveat', 'cursive'], serif: ['Lora', 'serif'] },
    boxShadow: { soft: '0 6px 24px -10px rgb(var(--text) / .22)', lift: '0 14px 34px -12px rgb(var(--text) / .3)' }
  } },
  plugins: []
}
