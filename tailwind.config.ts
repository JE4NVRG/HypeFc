import type { Config } from "tailwindcss"

/**
 * Identidade 002 "Mesa" (aprovada pelo Jean em 24/09/2026).
 *
 * Duas camadas convivem aqui de proposito:
 * 1. os nomes shadcn (background/foreground/card/border/ring), que os cinco
 *    componentes de src/components/ui consomem, apontando para os valores novos
 *    definidos em globals.css;
 * 2. as cores nomeadas da direcao (paper, ink, rule, sinal, verde, carimbo),
 *    que sao o vocabulario do painel e o que o DESIGN.md documenta.
 *
 * Raio 0 em TODA a escala e decisao da direcao, nao esquecimento: o painel
 * aprovado nao tem um unico canto arredondado. Fazer isso aqui (e nao removendo
 * classe por classe) evita que um `rounded-xl` esquecido em algum canto volte a
 * aparecer em producao.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
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
        // Inter Tight para titulo, nome de time e numero grande; JetBrains Mono
        // como fonte de trabalho (o painel e feito de numero alinhado).
        sans: ['var(--font-inter-tight)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
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
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        },

        /* ---- vocabulario da direcao 002 (mesa) ---- */
        paper: '#0B0E11',      /* fundo da mesa */
        'paper-2': '#12161B',  /* painel */
        'paper-3': '#1A212A',  /* painel elevado / linha sob o mouse */
        ink: '#E6EAF0',        /* texto principal */
        'ink-2': '#A7B2C0',    /* texto secundario */
        'ink-3': '#8C96A2',    /* rotulo tecnico (4,9:1 sobre o painel paper-3, medido) */
        rule: '#1F262E',       /* regua de 1px */
        'rule-2': '#161C23',   /* regua mais discreta */
        line: '#2A323C',       /* regua estrutural */
        verde: '#7BE495',      /* SO dado do modelo (maior probabilidade da linha) */
        'verde-2': '#A9F0BB',
        carimbo: '#FF6B6B',    /* erro / atencao */
        sinal: '#E8FF59',      /* acento acido: registro, numero do recorde e CTA */
      },
      borderRadius: {
        DEFAULT: '0px',
        none: '0px',
        sm: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '0px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
