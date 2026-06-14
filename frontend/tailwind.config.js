/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0f1d',
          card: '#111827',
          cardHover: '#1f2937',
          border: '#374151',
          success: '#10b981', // Neon Emerald
          warning: '#f59e0b', // Neon Amber
          danger: '#ef4444',  // Neon Red
          info: '#3b82f6',    // Neon Blue
          purple: '#8b5cf6',  // Cyber Purple
          textMuted: '#9ca3af',
          textActive: '#f3f4f6'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
}
