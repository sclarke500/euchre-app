#!/usr/bin/env node
/**
 * Sync the native shells' version numbers to packages/client/package.json.
 *
 * Why this matters: Capgo's resetWhenUpdate only discards a stored OTA bundle
 * when the NATIVE app version changes. With a static versionName, a new store
 * binary's baked-in web assets stay masked by whatever OTA bundle the device
 * downloaded earlier. Keeping versionName/MARKETING_VERSION in lockstep with
 * the web version makes every store release reset cleanly to its own bundle.
 *
 * What it writes (idempotent — only touches files when values differ):
 *   Android  android/app/build.gradle      versionName "X.Y.Z"
 *                                          versionCode  X*1000000 + Y*1000 + Z
 *   iOS      App.xcodeproj/project.pbxproj MARKETING_VERSION = X.Y.Z
 *                                          CURRENT_PROJECT_VERSION = same code
 *
 * The build number is derived from the semver so it's deterministic and
 * monotonic (1.0.6 → 1000006). Re-uploading the same store version requires a
 * patch bump first — which the OTA release flow does anyway.
 *
 * Runs automatically before `cap sync` via the cap:* npm scripts.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const clientDir = join(root, 'packages/client')

const pkg = JSON.parse(readFileSync(join(clientDir, 'package.json'), 'utf-8'))
const version = pkg.version
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
if (!m) {
  console.error(`✖ Bad version in client package.json: "${version}"`)
  process.exit(1)
}
// Deterministic, monotonic build number (Play Store cap is 2100000000, so
// majors up to ~2099 are safe; minor/patch must stay below 1000).
const buildCode = Number(m[1]) * 1_000_000 + Number(m[2]) * 1_000 + Number(m[3])

function patchFile(path, label, replacements) {
  if (!existsSync(path)) {
    console.log(`  ${label}: not found, skipping (${path})`)
    return
  }
  const before = readFileSync(path, 'utf-8')
  let after = before
  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(after)) {
      console.error(`✖ ${label}: expected pattern not found: ${pattern}`)
      process.exit(1)
    }
    after = after.replace(pattern, replacement)
  }
  if (after !== before) {
    writeFileSync(path, after)
    console.log(`  ${label}: → v${version} (build ${buildCode})`)
  } else {
    console.log(`  ${label}: already v${version}`)
  }
}

console.log(`Syncing native shell versions to ${version}…`)

patchFile(join(clientDir, 'android/app/build.gradle'), 'Android build.gradle', [
  [/versionCode \d+/, `versionCode ${buildCode}`],
  [/versionName "[^"]*"/, `versionName "${version}"`],
])

patchFile(join(clientDir, 'ios/App/App.xcodeproj/project.pbxproj'), 'iOS project.pbxproj', [
  [/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildCode};`],
  [/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`],
])
