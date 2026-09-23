/*
 * HypeFC - service worker.
 *
 * Deixa o dashboard instalavel e abrindo offline com a ultima rodada salva.
 * Sem dependencia externa (nada de next-pwa): arquivo unico servido como
 * esta de public/sw.js.
 *
 * Regra que nao se negocia: resposta da ESPN (site.api.espn.com) e de
 * qualquer outra origem NAO e cacheada. Placar velho vindo de cache e pior
 * que um erro de rede, porque o usuario acredita nele. Terceiro passa direto.
 */

// A versao do cache e carimbada pelo build (scripts/build-pages.mjs), nao a mao:
// se ela ficasse fixa, o stale-while-revalidate serviria o bundle antigo na
// primeira carga depois de cada deploy.
const CACHE_VERSION = '20260923T194848z'
const CACHE = `hypefc-${CACHE_VERSION}`
const CACHE_PREFIX = 'hypefc-'

// Precache so do app shell. Os bundles _next entram pelo
// stale-while-revalidate na primeira visita (o site e estatico, os nomes dos
// arquivos tem hash, entao nao existe cache infinito aqui).
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg']

// Destinos same-origin que usam stale-while-revalidate.
const ASSET_DESTINATIONS = ['script', 'style', 'image', 'font']

// Raiz do escopo real: new URL('./', .../sw.js) = '/'. Se o site for servido
// de subpasta (GitHub Pages sem dominio proprio) vira '/HypeFc/'.
const SCOPE_ROOT = new URL('./', self.location.href).pathname

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await precacheShell()
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await deleteOldCaches()
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  // (e) nada que nao seja GET interessa aqui.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // (d) outra origem: ESPN e afins passam direto, o service worker nem olha.
  if (url.origin !== self.location.origin) return

  // (e) fora do escopo do app nao e problema nosso.
  if (!url.pathname.startsWith(SCOPE_ROOT)) return

  // (a) navegacao: rede primeiro, cache como rede de seguranca.
  if (request.mode === 'navigate') {
    event.respondWith(safe(handleNavigate(request)))
    return
  }

  // (c) dado do painel (data/*.json): rede primeiro, nunca servir velho como novo.
  if (isDataJson(url.pathname)) {
    event.respondWith(safe(networkFirst(request)))
    return
  }

  // (b) app shell same-origin: responde do cache e atualiza em background.
  if (ASSET_DESTINATIONS.includes(request.destination)) {
    event.respondWith(safe(staleWhileRevalidate(request)))
    return
  }
})

/** Nenhuma falha de cache pode virar tela de erro: no pior caso, erro de rede. */
function safe(promise) {
  return promise.catch(() => Response.error())
}

function isDataJson(pathname) {
  return /\/data\/[^/]*\.json$/.test(pathname)
}

async function precacheShell() {
  try {
    const cache = await caches.open(CACHE)
    await Promise.all(
      SHELL.map(async (path) => {
        try {
          const response = await fetch(path, { cache: 'reload' })
          if (response.ok) await cache.put(path, response)
        } catch {
          // um arquivo ausente no deploy nao pode derrubar a instalacao toda
        }
      })
    )
  } catch {
    // sem Cache API nao ha o que fazer: o app segue funcionando online
  }
}

async function deleteOldCaches() {
  try {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map((key) => caches.delete(key))
    )
  } catch {
    // ignore
  }
}

/**
 * Grava e le sempre pela mesma chave (a URL), nunca pela Request original: a
 * requisicao do painel chega com cache 'no-store' e com cabecalhos que o
 * cache pode nao repetir, e ai o match falharia por causa do Vary.
 */
function cachePut(cache, url, response) {
  return cache.put(url, response).catch(() => undefined)
}

/** (a) navegacao: network-first com fallback para o cache e para o shell. */
async function handleNavigate(request) {
  let cache = null
  try {
    cache = await caches.open(CACHE)
  } catch {
    return fetch(request)
  }

  try {
    const response = await fetch(request)
    if (response.ok) cachePut(cache, request.url, response.clone())
    return response
  } catch {
    const cached =
      (await cache.match(request.url)) ||
      (await cache.match('./')) ||
      (await cache.match('./index.html'))
    return cached || Response.error()
  }
}

/** (b) stale-while-revalidate para script/style/image/font same-origin. */
async function staleWhileRevalidate(request) {
  let cache = null
  try {
    cache = await caches.open(CACHE)
  } catch {
    return fetch(request)
  }

  const cached = await cache.match(request.url)
  const update = fetch(request)
    .then((response) => {
      if (response.ok) cachePut(cache, request.url, response.clone())
      return response
    })
    .catch(() => undefined)

  if (cached) return cached
  return (await update) || Response.error()
}

// ---------------------------------------------------------------------------
// Alertas (Web Push) — o produto pago ("seu time joga hoje").
// ---------------------------------------------------------------------------
// O payload chega do cron (scripts/send-alerts.ts) como JSON puro:
//   { title, body, url, tag }
// Sem acoes na v1: o service worker mostra o que chegou e, no clique, abre o
// jogo. O texto e factual (time, adversario, horario e a probabilidade que o
// modelo publicou) — aqui nao se inventa nem se reformata numero nenhum.

/** Icone e badge do alerta: o mesmo icone instalavel do manifest. */
const NOTIFICATION_ICON = './icons/icon-192.png'

/** Aviso minimo quando o push chega sem payload utilizavel. */
const PUSH_PADRAO = { title: 'HypeFC', body: 'Seus times jogam hoje.' }

self.addEventListener('push', (event) => {
  // `event.data` pode vir nulo (push sem payload) e o corpo pode nao ser JSON:
  // nenhum dos dois pode terminar em push em branco, entao cai no padrao.
  let payload = null
  try {
    payload = event.data ? event.data.json() : null
  } catch {
    payload = null
  }
  const fonte = payload && typeof payload === 'object' ? payload : {}

  const title = texto(fonte.title) || PUSH_PADRAO.title
  const body = texto(fonte.body) || PUSH_PADRAO.body
  const tag = texto(fonte.tag) || 'hypefc-alerta'
  const data = { url: texto(fonte.url) || './' }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      // tag por jogo: entrega repetida do MESMO alerta substitui a notificacao
      // em vez de empilhar dois avisos do mesmo jogo.
      tag,
      data,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const dados = event.notification.data || {}
  // Relativo de proposito: o site tambem e servido de subpasta (GitHub Pages
  // sem dominio proprio) e a URL do payload e resolvida contra a raiz do escopo
  // do service worker.
  const destino = new URL(texto(dados.url) || './', self.location.href).href

  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const janela of janelas) {
        // Janela do app ja aberta (mesma origem): foca e leva para o jogo, em
        // vez de abrir uma segunda aba do mesmo painel.
        if (!mesmaOrigem(janela.url)) continue
        await janela.focus()
        if (typeof janela.navigate === 'function') await janela.navigate(destino)
        return
      }
      if (self.clients.openWindow) await self.clients.openWindow(destino)
    })()
  )
})

/** Texto nao vazio ou null (campo ausente/errado nunca vira "undefined" na tela). */
function texto(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

function mesmaOrigem(url) {
  try {
    return new URL(url).origin === self.location.origin
  } catch {
    return false
  }
}

/** (c) data/*.json: rede primeiro, cache so quando nao ha rede. */
async function networkFirst(request) {
  let cache = null
  try {
    cache = await caches.open(CACHE)
  } catch {
    return fetch(request)
  }

  try {
    // sem cache HTTP: com rede, o JSON vem sempre novo
    const response = await fetch(new Request(request, { cache: 'no-store' }))
    if (response.ok) cachePut(cache, request.url, response.clone())
    return response
  } catch {
    const cached = await cache.match(request.url)
    return cached || Response.error()
  }
}
