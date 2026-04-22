import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: ['class'],
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            screens: {
                'tablet': '800px',
                'tablet-land': '1200px',
            },
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                // ─── CÁPSULA Brand Tokens — Minimal Navy (dark-mode aware) ──
                // Consumen vars RGB triplet de globals.css (:root / .dark)
                capsula: {
                    coral: {
                        DEFAULT: 'rgb(var(--capsula-coral-rgb) / <alpha-value>)',
                        hover:   'rgb(var(--capsula-coral-hover-rgb) / <alpha-value>)',
                        light:   'rgb(var(--capsula-coral-light-rgb) / <alpha-value>)',
                        subtle:  'rgb(var(--capsula-coral-subtle-rgb) / <alpha-value>)',
                    },
                    navy: {
                        DEFAULT: 'rgb(var(--capsula-navy-rgb) / <alpha-value>)',
                        deep:    'rgb(var(--capsula-navy-deep-rgb) / <alpha-value>)',
                        light:   'rgb(var(--capsula-navy-light-rgb) / <alpha-value>)',
                        soft:    'rgb(var(--capsula-navy-soft-rgb) / <alpha-value>)',
                    },
                    ivory: {
                        DEFAULT: 'rgb(var(--capsula-ivory-rgb) / <alpha-value>)',
                        surface: 'rgb(var(--capsula-ivory-surface-rgb) / <alpha-value>)',
                        alt:     'rgb(var(--capsula-ivory-alt-rgb) / <alpha-value>)',
                    },
                    line: {
                        DEFAULT: 'rgb(var(--capsula-line-rgb) / <alpha-value>)',
                        strong:  'rgb(var(--capsula-line-strong-rgb) / <alpha-value>)',
                    },
                    ink: {
                        DEFAULT: 'rgb(var(--capsula-ink-rgb) / <alpha-value>)',
                        soft:    'rgb(var(--capsula-ink-soft-rgb) / <alpha-value>)',
                        muted:   'rgb(var(--capsula-ink-muted-rgb) / <alpha-value>)',
                        faint:   'rgb(var(--capsula-ink-faint-rgb) / <alpha-value>)',
                    },
                    gold: {
                        DEFAULT: 'rgb(var(--capsula-gold-rgb) / <alpha-value>)',
                        subtle:  'rgb(var(--capsula-gold-subtle-rgb) / <alpha-value>)',
                    },
                    // Legacy aliases
                    warm:  'rgb(var(--capsula-ivory-rgb) / <alpha-value>)',
                    muted: 'rgb(var(--capsula-ivory-alt-rgb) / <alpha-value>)',
                },
                tablepong: {
                    navy: '#1A2B5B',
                    red: '#E60023',
                    white: '#FFFFFF',
                    light: '#F8FAFC',
                },
                shanklish: {
                    gold: '#D4AF37',
                    olive: '#556B2F',
                    terracotta: '#E07C4C',
                    cream: '#FFF8E7',
                    charcoal: '#2D2D2D',
                },
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            fontFamily: {
                sans:    ['var(--font-body)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
                heading: ['var(--font-heading)', 'Georgia', 'serif'],
                mono:    ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
            },
            keyframes: {
                'fade-in':  { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                'slide-in': { '0%': { transform: 'translateX(-100%)' },              '100%': { transform: 'translateX(0)' } },
                'slide-up': { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
                pulse:      { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
                'spin-slow':{ '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
                // Minimal mark animations
                'cap-breathe': { '0%,100%': { transform: 'scale(.92)', opacity: '.6' }, '50%': { transform: 'scale(1.12)', opacity: '0' } },
                'cap-orbit':   { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
                'cap-orbit-r': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(-360deg)' } },
                'cap-sweep':   { '0%': { transform: 'translateX(-22px)', opacity: '0' }, '20%,80%': { opacity: '1' }, '100%': { transform: 'translateX(22px)', opacity: '0' } },
            },
            animation: {
                'fade-in': 'fade-in 0.3s ease-out',
                'slide-in': 'slide-in 0.3s ease-out',
                'slide-up': 'slide-up 0.4s ease-out',
                pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'spin-slow': 'spin-slow 3s linear infinite',
                'cap-breathe':  'cap-breathe 3.6s ease-in-out infinite',
                'cap-orbit':    'cap-orbit 10s linear infinite',
                'cap-orbit-r':  'cap-orbit-r 14s linear infinite',
                'cap-sweep':    'cap-sweep 4.5s ease-in-out infinite',
            },
            boxShadow: {
                'cap-soft':   '0 1px 2px rgba(11,23,39,0.04), 0 2px 8px rgba(11,23,39,0.04)',
                'cap-raised': '0 10px 24px -8px rgba(11,23,39,0.35)',
                'cap-deep':   '0 14px 28px -8px rgba(11,23,39,0.5)',
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
};

export default config;
