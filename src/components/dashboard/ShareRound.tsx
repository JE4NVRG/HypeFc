"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, MessageCircle, Send, Share2, Twitter } from 'lucide-react'

interface ShareRoundProps {
  /** Url pública da rodada/confronto. É o único link compartilhado. */
  url: string
  /** Texto montado por quem chama. Não prometemos nada aqui: só repassamos. */
  text: string
  /** Rótulo opcional à esquerda (ex: "Rodada 12"). */
  label?: string
}

const BTN =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.07] focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50'

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50'

/** Quanto tempo o aviso fica na tela antes de sumir. */
const OK_MS = 2000
const WARN_MS = 4000

export function ShareRound({ url, text, label }: ShareRoundProps) {
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'warn'; message: string } | null>(null)
  const [justCopied, setJustCopied] = useState(false)
  // Começa true para o HTML do servidor bater com o primeiro render do cliente.
  // A checagem real de navigator.clipboard acontece no efeito, depois da montagem.
  const [canCopy, setCanCopy] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Um único timer por vez e sempre limpo: nada de setTimeout solto sobrevivendo
  // ao desmonte ou empilhando avisos antigos em cima de novos.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) setCanCopy(false)
  }, [])

  const showFeedback = useCallback((tone: 'ok' | 'warn', message: string, ms: number) => {
    if (timer.current) clearTimeout(timer.current)
    setFeedback({ tone, message })
    timer.current = setTimeout(() => {
      setFeedback(null)
      setJustCopied(false)
    }, ms)
  }, [])

  /** Copia e avisa. Devolve false quando não existe área de transferência utilizável. */
  const copyLink = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      // Contexto antigo (http): em vez de falhar em silêncio, expõe o link.
      setCanCopy(false)
      showFeedback('warn', 'Selecione o link abaixo para copiar', WARN_MS)
      return false
    }
    try {
      await navigator.clipboard.writeText(url)
      setJustCopied(true)
      showFeedback('ok', 'Link copiado', OK_MS)
      return true
    } catch {
      setCanCopy(false)
      showFeedback('warn', 'Selecione o link abaixo para copiar', WARN_MS)
      return false
    }
  }, [showFeedback, url])

  const handleShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'HypeFC', text, url })
        return
      } catch (err) {
        // Cancelar faz parte: o usuário fechou a folha de compartilhamento.
        const name = (err as { name?: string } | null)?.name
        if (name === 'AbortError') return
      }
      const copied = await copyLink()
      if (copied) {
        showFeedback('warn', 'Compartilhamento indisponível — link copiado', WARN_MS)
      }
      return
    }
    // Desktop sem Web Share: cai no copiar em vez de não fazer nada.
    const copied = await copyLink()
    if (copied) {
      showFeedback('warn', 'Compartilhamento do navegador indisponível — link copiado', WARN_MS)
    }
  }, [copyLink, showFeedback, text, url])

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
  const tgHref = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Compartilhar a rodada">
      {label && <span className="mr-0.5 text-[11px] text-slate-500">{label}</span>}

      <button type="button" onClick={handleShare} aria-label="Compartilhar rodada" className={BTN_PRIMARY}>
        <Share2 className="h-3.5 w-3.5" />
        Compartilhar
      </button>

      {/* Sempre visíveis: no desktop não existe navigator.share, e o grupo de
          WhatsApp/Telegram é justamente onde a rodada circula. */}
      <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no WhatsApp" className={BTN}>
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </a>
      <a href={tgHref} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no Telegram" className={BTN}>
        <Send className="h-3.5 w-3.5" />
        Telegram
      </a>
      <a href={xHref} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no X (Twitter)" className={BTN}>
        <Twitter className="h-3.5 w-3.5" />
        X
      </a>

      {canCopy ? (
        <button type="button" onClick={copyLink} aria-label="Copiar link da rodada" className={BTN}>
          {justCopied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {justCopied ? 'Link copiado' : 'Copiar link'}
        </button>
      ) : (
        <input
          readOnly
          value={url}
          aria-label="Link da rodada (selecione e copie)"
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
          className="min-w-[16rem] flex-1 rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1.5 font-mono text-[11px] text-slate-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50"
        />
      )}

      <span
        role="status"
        aria-live="polite"
        className={`text-[11px] ${
          feedback?.tone === 'warn' ? 'text-amber-300/90' : 'text-emerald-300'
        }`}
      >
        {feedback && feedback.message !== 'Link copiado' ? feedback.message : ''}
      </span>
    </div>
  )
}
