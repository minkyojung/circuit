import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
    './components/**/*.{ts,tsx}',
    './node_modules/fumadocs-ui/dist/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
