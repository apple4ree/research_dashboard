import type { Config } from 'tailwindcss';
import { colors } from './lib/theme/tokens';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: colors.canvas,
        fg: colors.fg,
        'border-default': colors.border.default,
        'border-muted': colors.border.muted,
        accent: colors.accent,
        success: colors.success,
        danger: colors.danger,
        attention: colors.attention,
        done: colors.done,
        neutral: colors.neutral,
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: ['11px', '16px'],
        sm: ['12px', '18px'],
        base: ['14px', '20px'],
        lg: ['16px', '24px'],
      },
    },
  },
  plugins: [],
} satisfies Config;
