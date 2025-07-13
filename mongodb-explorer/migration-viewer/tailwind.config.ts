interface TailwindConfig {
  content: string[]
  theme: {
    extend: Record<string, any>
  }
  plugins: any[]
}

/** @type {import('tailwindcss').Config} */
const config: TailwindConfig = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config