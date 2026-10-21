/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Paleta Primária Institucional: Lynx Deep Forest & Pine Green
                // Mantém a chave 'blue' para garantir que mais de 100 páginas herdem a nova identidade instantaneamente
                blue: {
                    50: '#f0f4f2',
                    100: '#e0eae5',
                    200: '#c3d5cc',
                    300: '#9fbcb0',
                    400: '#6f9585',
                    500: '#425750', // Lynx Forest Green (Primary)
                    600: '#32423d', // Lynx Dark Forest (Corporate Base)
                    700: '#283531',
                    800: '#1e2825', // Lynx Deep Forest Background
                    900: '#161e1c',
                    950: '#0d1311',
                },
                // Aliases semânticos universais
                primary: {
                    50: '#f0f4f2',
                    100: '#e0eae5',
                    200: '#c3d5cc',
                    300: '#9fbcb0',
                    400: '#6f9585',
                    500: '#425750',
                    600: '#32423d',
                    700: '#283531',
                    800: '#1e2825',
                    900: '#161e1c',
                    DEFAULT: '#425750',
                    hover: '#32423d',
                    dark: '#1e2825',
                    accent: '#e0e800',
                },
                orange: {
                    50: '#fff9f0',
                    100: '#fff3db',
                    200: '#ffe1af',
                    300: '#ffcf83',
                    400: '#ffab2b',
                    500: '#ffb536', // Lynx EMS Exact Orange
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
