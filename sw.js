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

// Suba a versao ao mudar SHELL: o activate apaga as versoes antigas.
const CACHE_VERSION = 'v1'
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
