/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Fraunces', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display': ['2.25rem', { lineHeight: '1.1', fontWeight: '700' }],
        'h1': ['1.75rem', { lineHeight: '1.2', fontWeight: '600' }],
        'h2': ['1.375rem', { lineHeight: '1.25', fontWeight: '600' }],
        'h3': ['1.125rem', { lineHeight: '1.3', fontWeight: '600' }],
        'body': ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
        'overline': ['0.6875rem', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' }],
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
          hover: 'hsl(var(--primary-hover))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        // Semantic Colors
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))'
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))'
        },
        // Category Colors
        category: {
          produce: 'hsl(var(--category-produce))',
          protein: 'hsl(var(--category-protein))',
          dairy: 'hsl(var(--category-dairy))',
          grains: 'hsl(var(--category-grains))',
          spices: 'hsl(var(--category-spices))',
          frozen: 'hsl(var(--category-frozen))',
          pantry: 'hsl(var(--category-pantry))'
        }
      },
      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        drag: 'var(--shadow-drag)',
      },
      transitionTimingFunction: {
        'ease-out': 'var(--ease-out)',
        'ease-in-out': 'var(--ease-in-out)',
        'spring': 'var(--spring)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        },
        'pulse-subtle': {
          '0%, 100%': {
            opacity: '1'
          },
          '50%': {
            opacity: '0.85'
          }
        },
        'favorite-pop': {
          '0%': {
            transform: 'scale(1)'
          },
          '25%': {
            transform: 'scale(1.3)'
          },
          '50%': {
            transform: 'scale(0.9)'
          },
          '75%': {
            transform: 'scale(1.1)'
          },
          '100%': {
            transform: 'scale(1)'
          }
        },
        'celebration-burst': {
          '0%': {
            transform: 'scale(0)',
            opacity: '1'
          },
          '50%': {
            transform: 'scale(1.2)',
            opacity: '0.8'
          },
          '100%': {
            transform: 'scale(1.5)',
            opacity: '0'
          }
        },
        'confetti-fall': {
          '0%': {
            transform: 'translateY(-100%) rotate(0deg)',
            opacity: '1'
          },
          '100%': {
            transform: 'translateY(100vh) rotate(720deg)',
            opacity: '0'
          }
        },
        'check-bounce': {
          '0%': {
            transform: 'scale(0)'
          },
          '50%': {
            transform: 'scale(1.3)'
          },
          '70%': {
            transform: 'scale(0.9)'
          },
          '100%': {
            transform: 'scale(1)'
          }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        'favorite-pop': 'favorite-pop 0.4s var(--spring)',
        'celebration-burst': 'celebration-burst 0.6s ease-out forwards',
        'confetti-fall': 'confetti-fall 3s ease-in-out forwards',
        'check-bounce': 'check-bounce 0.5s var(--spring)'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
}
