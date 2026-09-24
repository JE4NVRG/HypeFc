/**
 * Fonte dos payloads que o painel lê em runtime (registro, ratings, título,
 * probabilidades).
 *
 * Ordem: Supabase (RPC `payload_publico`) e, se ele não responder, o arquivo
 * `public/data/<nome>.json` que vai dentro do build.
 *
 * Por que nessa ordem: o payload no banco é o mais novo — o job diário da VPS o
 * grava logo depois de calcular, então o número do site atualiza sem build e sem
 * deploy. O arquivo continua sendo a rede de segurança: Supabase fora do ar (ou
 * um build antigo, anterior a esta migração) mostra o último dado publicado
 * junto com o código, em vez de tela vazia.
 *
 * Só roda no navegador (todos os chamadores estão dentro de useEffect): durante
 * o build estático nada é buscado, então o HTML pré-renderizado não muda.
 */

export type NomePayload =
  | 'hype-record'
  | 'ratings'
  | 'title-odds'
  | 'probability-record'
  | 'probability-forward'

/** Curto de propósito: se o banco demorar, o arquivo do build responde antes. */
const TIMEOUT_MS = 4000

function lerAmbiente(chave: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  // Referência literal: é assim que o Next inlina variável NEXT_PUBLIC_* no build.
  const valor = chave === 'NEXT_PUBLIC_SUPABASE_URL'
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return (valor ?? '').trim()
}

function bancoConfigurado(): boolean {
  return lerAmbiente('NEXT_PUBLIC_SUPABASE_URL') !== '' && lerAmbiente('NEXT_PUBLIC_SUPABASE_ANON_KEY') !== ''
}

/** Payload do banco. `null` = não tem (ainda) ou não deu: cai para o arquivo. */
async function doBanco<T>(nome: NomePayload): Promise<T | null> {
  if (typeof window === 'undefined' || !bancoConfigurado()) return null

  const url = lerAmbiente('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
  const chave = lerAmbiente('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null

  try {
    const resposta = await fetch(`${url}/rest/v1/rpc/payload_publico`, {
      method: 'POST',
      cache: 'no-store',
      signal: controller?.signal,
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_nome: nome }),
    })
    if (!resposta.ok) return null
    const dados = (await resposta.json()) as T | null
    // A RPC devolve null para nome fora da lista ou payload ainda não publicado.
    return dados ?? null
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Arquivo publicado junto com o build. `null` quando não existe/ilegível. */
async function doArquivo<T>(nome: NomePayload): Promise<T | null> {
  if (typeof window === 'undefined') return null
  try {
    // Caminho relativo: funciona no dev (raiz) e no Pages (sob /HypeFc).
    const resposta = await fetch(`data/${nome}.json`, { cache: 'no-store' })
    if (!resposta.ok) return null
    return (await resposta.json()) as T
  } catch {
    return null
  }
}

export async function buscarPayload<T>(nome: NomePayload): Promise<T | null> {
  const doServidor = await doBanco<T>(nome)
  if (doServidor !== null) return doServidor

  if (bancoConfigurado() && typeof window !== 'undefined') {
    console.warn(`[payload] ${nome}: banco indisponível ou ainda sem publicação — usando o arquivo do build`)
  }
  return doArquivo<T>(nome)
}
