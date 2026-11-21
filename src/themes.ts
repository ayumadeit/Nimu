export type Palette = { bg: string; surface: string; primary: string; secondary: string; accent: string; text: string; border: string }
export type Theme = { id: string; name: string; light: Palette; dark: Palette; baseId?: string; custom?: boolean }
export const PALETTE_KEYS: { key: keyof Palette; label: string }[] = [
  { key: 'bg', label: 'Background' }, { key: 'surface', label: 'Surface' }, { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' }, { key: 'accent', label: 'Accent' }, { key: 'text', label: 'Text' }, { key: 'border', label: 'Borders' }]
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const hex = (c: number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v * (1 - t) + y[i] * t)) }
export const makeDark = (l: Palette): Palette => {
  const bg = mix(l.bg, '#15121b', 0.92)
  return { bg, surface: mix(bg, '#ffffff', 0.06), primary: mix(l.primary, '#ffffff', 0.12), secondary: mix(l.secondary, '#ffffff', 0.1),
    accent: mix(l.accent, '#ffffff', 0.1), text: mix(bg, '#ffffff', 0.92), border: mix(bg, '#ffffff', 0.12) }
}
const P = (bg: string, surface: string, primary: string, secondary: string, accent: string, text: string, border: string): Palette => ({ bg, surface, primary, secondary, accent, text, border })
const t = (id: string, name: string, l: Palette, d?: Palette): Theme => ({ id, name, light: l, dark: d ?? makeDark(l) })
export const PRESETS: Theme[] = [
  t('original', 'Nimu Original', P('#FFF7F0', '#FFFFFF', '#FF8A4C', '#8B6BE8', '#1FC8A0', '#3A2F45', '#F1E3D6')),
  t('matcha', 'Matcha', P('#F6F3E7', '#FDFBF3', '#7C9A6D', '#A8BFA0', '#D9C79A', '#2F3B2B', '#E3DFC8')),
  t('lavender', 'Lavender', P('#F6F2FC', '#FFFFFF', '#9B7EDE', '#C9B6F0', '#E6A8D7', '#3B2E55', '#E6DDF5')),
  t('mocha', 'Mocha', P('#F5ECE1', '#FBF6EF', '#B07A4B', '#D9BFA0', '#6B4A35', '#3E2B20', '#E6D6C3')),
  t('sakura', 'Sakura', P('#FFF4F5', '#FFFFFF', '#E58FA3', '#F4C2CC', '#B86B80', '#4A2E36', '#F6DEE2')),
  t('peachy', 'Peachy', P('#FFF3EA', '#FFFFFF', '#FF9E7A', '#FFC9A6', '#F6B26B', '#4A3228', '#F8DFCD')),
  t('ocean', 'Ocean', P('#EFF8FB', '#FFFFFF', '#4BA3C7', '#8CCFE0', '#3CC4BE', '#1F3A4A', '#D5EAF1')),
  t('buttercup', 'Buttercup', P('#FFFBEA', '#FFFEF7', '#E8B923', '#F6DE8D', '#F29E4C', '#453A1F', '#F2E8BE')),
  t('midnight', 'Midnight', P('#F1F2FA', '#FFFFFF', '#5B5FC7', '#A9A4F0', '#7DA3FF', '#1B1F3B', '#DDE0F2'),
    P('#12142B', '#1B1E3D', '#A9A4F0', '#6C70D8', '#8FB3FF', '#E8E9FA', '#2D3160')),
  t('minimal', 'Minimal', P('#FAFAFA', '#FFFFFF', '#222222', '#777777', '#444444', '#1A1A1A', '#E5E5E5'),
    P('#121212', '#1A1A1A', '#EEEEEE', '#999999', '#CCCCCC', '#F2F2F2', '#2C2C2C')),
]
export const applyPalette = (p: Palette, dark: boolean) => {
  const r = document.documentElement
  ;(Object.keys(p) as (keyof Palette)[]).forEach(k => r.style.setProperty('--' + k, rgb(p[k]).join(' ')))
  r.classList.toggle('dark', dark); r.style.colorScheme = dark ? 'dark' : 'light'
}
