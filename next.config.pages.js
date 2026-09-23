/**
 * Config usada apenas no build estatico para o GitHub Pages.
 * O build normal (SSR, com as rotas /api) usa next.config.js.
 *
 * O Pages serve o projeto em https://<user>.github.io/HypeFc/, por isso o
 * basePath. O modo estatico nao tem servidor: o navegador chama a ESPN direto.
 */
const basePath = process.env.PAGES_BASE_PATH || '/HypeFc'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'crests.football-data.org', pathname: '/**' },
      { protocol: 'https', hostname: 'api.football-data.org', pathname: '/**' },
      { protocol: 'https', hostname: 'a.espncdn.com', pathname: '/**' },
    ],
  },
}

module.exports = nextConfig
