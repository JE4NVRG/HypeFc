#!/usr/bin/env node
/**
 * Gera o site estatico (pasta out/) para o GitHub Pages.
 *
 * Por que este script existe: as rotas em src/app/api usam force-dynamic e
 * quebram o `output: export` do Next ("cannot be used with output: export").
 * No modo estatico elas sao desnecessarias, porque o navegador busca a ESPN
 * direto. Entao o script afasta src/app/api durante o build e devolve depois —
 * sempre, inclusive se o build falhar.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workDir = resolve(root, '.pages-build')
const apiDir = resolve(root, 'src/app/api')
const stashDir = resolve(workDir, 'api-stash')
const configPath = resolve(root, 'next.config.js')
const configBackup = resolve(workDir, 'next.config.js.bak')
const pagesConfig = resolve(root, 'next.config.pages.js')
const basePath = process.env.PAGES_BASE_PATH ?? '/HypeFc'
// Dominio proprio (ex hypefc.je4ndev.com): o Pages identifica o dominio pelo
// arquivo CNAME no branch publicado, e o deploy apaga a arvore inteira a cada
// rodada — entao o CNAME precisa sair do proprio build, senao o dominio cai.
const customDomain = process.env.PAGES_CUSTOM_DOMAIN || ''

function restore() {
  if (existsSync(stashDir)) {
    rmSync(apiDir, { recursive: true, force: true })
    cpSync(stashDir, apiDir, { recursive: true })
    rmSync(stashDir, { recursive: true, force: true })
    console.log('[pages] src/app/api restaurado')
  }
  if (existsSync(configBackup)) {
    writeFileSync(configPath, readFileSync(configBackup))
    console.log('[pages] next.config.js restaurado')
  }
  rmSync(workDir, { recursive: true, force: true })
}

let failed = false
try {
  rmSync(workDir, { recursive: true, force: true })
  mkdirSync(workDir, { recursive: true })
  writeFileSync(configBackup, readFileSync(configPath))

  writeFileSync(configPath, readFileSync(pagesConfig))
  console.log('[pages] next.config.pages.js aplicado')

  if (existsSync(apiDir)) {
    cpSync(apiDir, stashDir, { recursive: true })
    rmSync(apiDir, { recursive: true, force: true })
    console.log('[pages] src/app/api afastado durante o build')
  }

  rmSync(resolve(root, '.next'), { recursive: true, force: true })
  rmSync(resolve(root, 'out'), { recursive: true, force: true })

  execFileSync('npx', ['next', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_PUBLIC_DATA_MODE: 'static',
      PAGES_BASE_PATH: basePath,
    },
  })

  if (!existsSync(resolve(root, 'out/index.html'))) {
    throw new Error('out/index.html nao foi gerado')
  }
  if (customDomain) {
    writeFileSync(resolve(root, 'out/CNAME'), `${customDomain}\n`)
    console.log(`[pages] CNAME gravado: ${customDomain}`)
  }
  console.log(`[pages] build estatico pronto em out/ (basePath ${basePath || '/'})`)
} catch (error) {
  failed = true
  console.error('[pages] build falhou:', error instanceof Error ? error.message : error)
} finally {
  restore()
}

process.exit(failed ? 1 : 0)
