#!/usr/bin/env node
/**
 * Build and publish an OTA web-bundle update for the native apps.
 *
 * What it does:
 *   1. Builds the client (unless --skip-build)
 *   2. Zips packages/client/dist (excluding research/ and ota/)
 *   3. Publishes the zip:
 *        - GitHub Release `ota-v{version}` if the `gh` CLI is installed+authed
 *          (preferred — keeps 12MB zips out of git history)
 *        - otherwise falls back to packages/client/public/ota/ (committed to git)
 *   4. Writes packages/client/public/ota/latest.json — the manifest the native
 *      apps poll (via useAppUpdates) to discover updates
 *
 * Afterwards: commit + push. Netlify deploys the manifest (and the PWA);
 * native apps pick up the new bundle on next launch or via Settings.
 *
 * Remember: bump packages/client/package.json version first — the check is
 * "manifest version > running bundle's baked-in __APP_VERSION__".
 * And never ship an OTA bundle that needs native code not already in the
 * store binary (new plugins etc. require a real App Store / Play release).
 */

import { execSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, copyFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const clientDir = join(root, 'packages/client')
const distDir = join(clientDir, 'dist')
const otaPublicDir = join(clientDir, 'public/ota')
const SITE_URL = 'https://67cardgames.com'

const skipBuild = process.argv.includes('--skip-build')
const forceLocal = process.argv.includes('--local')
// --bump: if package.json's version isn't already ahead of the published
// manifest, auto-increment the patch number (so `npm run release` needs no
// manual edit; a hand-bumped version is respected as-is).
const autoBump = process.argv.includes('--bump')
// --push: git add/commit/push after publishing, so the manifest deploys.
const doPush = process.argv.includes('--push')

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts })
}

function fail(msg) {
  console.error(`\n✖ ${msg}`)
  process.exit(1)
}

// --- 1. Version ------------------------------------------------------------
const pkg = JSON.parse(readFileSync(join(clientDir, 'package.json'), 'utf-8'))
let version = pkg.version
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`Bad version in client package.json: "${version}"`)

const manifestPath = join(otaPublicDir, 'latest.json')
if (existsSync(manifestPath)) {
  const prev = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  const newer = version.split('.').map(Number)
  const old = String(prev.version || '0.0.0').split('.').map(Number)
  const cmp = (() => {
    for (let i = 0; i < 3; i++) {
      if (newer[i] !== old[i]) return newer[i] - old[i]
    }
    return 0
  })()
  if (cmp <= 0) {
    if (autoBump) {
      // Not hand-bumped — increment the patch of the published version.
      // Must happen BEFORE the build so __APP_VERSION__ bakes the new number.
      version = `${old[0]}.${old[1]}.${old[2] + 1}`
      console.log(`Auto-bumping version: ${prev.version} → ${version}`)
      run(`npm version ${version} --no-git-tag-version`, { cwd: clientDir })
    } else {
      fail(`Version ${version} is not newer than published ${prev.version}.\n  Bump packages/client/package.json first (or run with --bump).`)
    }
  }
}

console.log(`\n📦 OTA release v${version}\n`)

// --- 2. Build ----------------------------------------------------------------
if (!skipBuild) {
  console.log('Building shared + client…')
  run('npm run build')
} else {
  console.log('Skipping build (--skip-build)')
}
if (!existsSync(join(distDir, 'index.html'))) fail('dist/index.html missing — build failed?')

// --- 3. Zip dist -------------------------------------------------------------
const zipName = `bundle-${version}.zip`
const zipPath = join(tmpdir(), zipName)
rmSync(zipPath, { force: true })
console.log('Zipping dist…')
// index.html must sit at the zip root. research/ is dev-only reference
// material; ota/ would recursively embed previous bundles.
run(`zip -q -r "${zipPath}" . -x "research/*" -x "research/" -x "ota/*" -x "ota/" -x "*.DS_Store"`, { cwd: distDir })

const zipBytes = readFileSync(zipPath)
const sha256 = createHash('sha256').update(zipBytes).digest('hex')
console.log(`  ${zipName}: ${(zipBytes.length / 1024 / 1024).toFixed(1)} MB, sha256 ${sha256.slice(0, 12)}…`)

// --- 4. Publish the zip --------------------------------------------------------
mkdirSync(otaPublicDir, { recursive: true })

function ghAvailable() {
  if (forceLocal) return false
  const which = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' })
  return which.status === 0
}

let bundleUrl
if (ghAvailable()) {
  const remote = execSync('git remote get-url origin', { cwd: root }).toString().trim()
  const m = remote.match(/github\.com[:/](.+?)(?:\.git)?$/)
  if (!m) fail(`Cannot parse GitHub repo from remote: ${remote}`)
  const repo = m[1]
  const tag = `ota-v${version}`
  console.log(`Publishing to GitHub Release ${tag}…`)
  run(`gh release create "${tag}" "${zipPath}" --repo "${repo}" --title "OTA bundle v${version}" --notes "Web bundle for native OTA update."`)
  bundleUrl = `https://github.com/${repo}/releases/download/${tag}/${zipName}`
  // Clean any zips left in public/ota from local-mode releases
  for (const f of readdirSync(otaPublicDir)) {
    if (f.endsWith('.zip')) rmSync(join(otaPublicDir, f))
  }
} else {
  console.log('gh CLI not available/authed — falling back to public/ota/ (committed to git).')
  console.log('  Tip: `brew install gh && gh auth login` to host bundles on GitHub Releases instead.')
  for (const f of readdirSync(otaPublicDir)) {
    if (f.endsWith('.zip')) rmSync(join(otaPublicDir, f))
  }
  copyFileSync(zipPath, join(otaPublicDir, zipName))
  bundleUrl = `${SITE_URL}/ota/${zipName}`
}

// --- 5. Manifest ---------------------------------------------------------------
const manifest = {
  version,
  url: bundleUrl,
  sha256,
  builtAt: new Date().toISOString(),
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`\n✔ Wrote public/ota/latest.json → ${bundleUrl}`)

// --- 6. Commit + push (--push) ---------------------------------------------
if (doPush) {
  console.log('\nCommitting and pushing:')
  run('git status --short')
  run('git add -A')
  run(`git commit -m "release: OTA v${version}"`)
  run('git push')
  console.log(`
✔ Released v${version}. Netlify deploys the manifest in ~1 min;
  native apps pick it up on next launch / Settings → Check for Updates.
`)
} else {
  console.log(`
Next steps:
  1. git add + commit + push  (Netlify deploys the manifest & PWA)
  2. Native apps see v${version} on next launch / Settings → Check for Updates
`)
}
