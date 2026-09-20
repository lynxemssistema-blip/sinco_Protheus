/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                blue: {
                    50: '#f4f6f9',
                    100: '#e9eef4',
                    200: '#c8d4e4',
                    300: '#a7bad3',
                    400: '#6586b2',
                    500: '#325886',
                    600: '#1f365c', // Metalfisa Exact Blue
                    700: '#1a2e4e',
                    800: '#15253f',
                    900: '#111e33',
                    950: '#0a121e',
                },
                orange: {
                    50: '#fff9f0',
                    100: '#fff3db',
                    200: '#ffe1af',
                    300: '#ffcf83',
                    400: '#ffab2b',
                    500: '#ffb536', // Metalfisa Exact Orange
                    600: '#e69a22',
                    700: '#bf7b15',
                    800: '#99600f',
                    900: '#7d4d0f',
                    950: '#472904',
                },
                lynx: {
                    dark: '#32423D',       // Base Forest Slate / Dark Tone
                    forest: '#425750',     // Medium Forest Green / Primary
                    metal: '#6F7170',      // Soft Metal Gray / Subtle Neutral
                    snow: '#F9F8F3',       // Warm Ivory Snow White
                    lime: '#E0E800',       // Electric Lime IDV Accent
                    deep: '#23302C',       // Deeper Forest Slate
                }
            }
        },
    },
    plugins: [],
}
