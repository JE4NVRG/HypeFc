/**
 * Estilos das paginas publicas (venda, entrar, criar conta, conta).
 *
 * Os mesmos valores do painel (`ProView.tsx`), num lugar so: a direcao 002 tem
 * raio 0 em toda a escala, `sinal` e acento de CTA, `paper-3` e regua de caixa e
 * `ink-3` e o rotulo tecnico (4,9:1 medido sobre o painel). Botao sempre com piso
 * de 44px no mobile e 36px a partir de sm, que e o que o gate de UI cobra.
 */
export const CAIXA = 'rounded-lg border border-paper-3 bg-paper/30 p-4 sm:p-5'
export const ROTULO = 'text-[11px] font-semibold uppercase tracking-wider text-ink-3'

export const BOTAO_PRIMARIO =
  'inline-flex min-h-[44px] w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-sinal px-5 text-[14px] font-semibold text-paper transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[36px] sm:w-auto sm:text-[13px]'

export const BOTAO_SECUNDARIO =
  'inline-flex min-h-[44px] w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-paper-3/60 px-5 text-[14px] font-medium text-ink transition hover:bg-line/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[36px] sm:w-auto sm:text-[13px]'

export const CAMPO =
  'mt-1 h-11 w-full rounded-lg border border-line bg-paper/60 px-3 text-[14px] text-ink placeholder:text-ink-3 focus:border-ink/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60'

export const LINK = 'text-ink-2 underline decoration-ink/20 underline-offset-2 transition hover:text-ink hover:decoration-ink/50'

export const LINK_NAV =
  'inline-flex min-h-[44px] items-center rounded-lg px-2.5 text-[13px] font-medium text-ink-2 transition hover:bg-ink/5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 sm:min-h-[36px]'
