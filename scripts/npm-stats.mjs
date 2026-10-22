import { writeFile, mkdir } from 'node:fs/promises'
import { PROFILE_USER, fetchJson } from './lib/http.mjs'

const MAINTAINER = process.env.NPM_MAINTAINER || PROFILE_USER
const OUT_DIR = process.env.OUT_DIR || 'dist'
const NPM_RED = 'cb0000'
const PAGE = 250

const nf = new Intl.NumberFormat('en-US')

async function discoverPackages() {
  const names = new Set()
  for (let from = 0; ; from += PAGE) {
    const data = await fetchJson(
      `https://registry.npmjs.org/-/v1/search?text=maintainer:${MAINTAINER}&size=${PAGE}&from=${from}`,
    )
    const objects = data.objects ?? []
    for (const o of objects) names.add(o.package.name)
    if (objects.length < PAGE) break
  }
  return [...names]
}

async function monthlyDownloads(pkg) {
  try {
    const data = await fetchJson(
      `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkg)}`,
    )
    return data.downloads ?? 0
  } catch {
    return 0
  }
}

const packages = await discoverPackages()
const downloads = await Promise.all(packages.map(monthlyDownloads))
const total = downloads.reduce((sum, n) => sum + n, 0)

const badge = {
  schemaVersion: 1,
  label: 'npm downloads',
  message: `${nf.format(total)} / month`,
  color: NPM_RED,
  namedLogo: 'npm',
}

await mkdir(OUT_DIR, { recursive: true })
await writeFile(`${OUT_DIR}/npm-total.json`, JSON.stringify(badge))

console.log(`npm-stats: ${packages.length} packages, ${total}/mo total`)
