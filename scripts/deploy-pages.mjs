#!/usr/bin/env node
/**
 * Publica o site estatico no branch gh-pages — sem depender do GitHub Actions.
 *
 * O workflow .github/workflows/pages.yml faz o mesmo, mas no momento os jobs de
 * usuario desta conta nao recebem runner (nem um probe de 3 linhas inicia), entao
 * o deploy manual e o caminho que funciona. Este script automatiza o que antes
 * era feito na mao: build estatico + commit no gh-pages.
 *
 * Uso: npm run deploy:pages
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'out')
const treeDir = resolve(root, '.pages-deploy/gh-pages')

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts })
}

function runQuiet(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts }).trim()
}

function cleanup() {
  try {
    runQuiet('git', ['worktree', 'remove', '--force', treeDir])
  } catch {
    /* worktree ja removido */
  }
  try {
    runQuiet('git', ['worktree', 'prune'])
  } catch {
    /* nada a podar */
  }
  rmSync(resolve(root, '.pages-deploy'), { recursive: true, force: true })
}

let failed = false
try {
  console.log('[deploy] 1/4 build estatico')
  run('node', ['scripts/build-pages.mjs'])
  if (!existsSync(resolve(outDir, 'index.html'))) {
    throw new Error('out/index.html nao existe')
  }

  console.log('[deploy] 2/4 preparando worktree do gh-pages')
  cleanup()
  mkdirSync(dirname(treeDir), { recursive: true })
  runQuiet('git', ['worktree', 'add', '--detach', treeDir])

  const hasRemoteBranch = runQuiet('git', ['ls-remote', '--heads', 'origin', 'gh-pages']).length > 0
  if (hasRemoteBranch) {
    run('git', ['fetch', '--quiet', 'origin', 'gh-pages'], { cwd: treeDir })
    run('git', ['checkout', '--quiet', '-B', 'gh-pages', 'FETCH_HEAD'], { cwd: treeDir })
  } else {
    run('git', ['checkout', '--quiet', '--orphan', 'gh-pages'], { cwd: treeDir })
  }

  console.log('[deploy] 3/4 copiando o build para o gh-pages')
  for (const entry of readdirSync(treeDir)) {
    if (entry === '.git') continue
    rmSync(resolve(treeDir, entry), { recursive: true, force: true })
  }
  cpSync(outDir, treeDir, { recursive: true })
  // Sem .nojekyll o Pages ignora pastas com underscore, e _next desaparece.
  writeFileSync(resolve(treeDir, '.nojekyll'), '')

  run('git', ['add', '-A'], { cwd: treeDir })
  const status = runQuiet('git', ['status', '--porcelain'], { cwd: treeDir })
  if (!status) {
    console.log('[deploy] nada mudou no gh-pages; deploy nao necessario')
  } else {
    const sha = runQuiet('git', ['rev-parse', '--short', 'HEAD'])
    run(
      'git',
      [
        '-c', 'user.name=JE4NVRG',
        '-c', 'user.email=jean@je4ndev.com',
        'commit', '--quiet', '-m', `deploy: site estatico do ${sha}`,
      ],
      { cwd: treeDir }
    )
    console.log('[deploy] 4/4 empurrando para gh-pages')
    run('git', ['push', '--force', 'origin', 'gh-pages'], { cwd: treeDir })
    const dominio = (process.env.PAGES_CUSTOM_DOMAIN || '').trim()
    console.log(
      dominio
        ? `[deploy] pronto: https://${dominio}/`
        : '[deploy] pronto: https://je4nvrg.github.io/HypeFc/'
    )
  }
} catch (error) {
  failed = true
  console.error('[deploy] falhou:', error instanceof Error ? error.message : error)
} finally {
  cleanup()
}

process.exit(failed ? 1 : 0)
