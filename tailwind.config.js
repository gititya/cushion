/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // Disable preflight so MUI's CSS baseline is not overridden
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
      colors: {
        primary: '#6750A4',
        'on-primary': '#FFFFFF',
        'primary-container': '#EADDFF',
        'on-primary-container': '#21005D',
        secondary: '#625B71',
        'secondary-container': '#E8DEF8',
        tertiary: '#7D5260',
        'tertiary-container': '#FFD8E4',
        surface: '#FEF7FF',
        'surface-variant': '#E7E0EC',
        outline: '#79747E',
        error: '#B3261E',
      },
    },
  },
  plugins: [],
}
