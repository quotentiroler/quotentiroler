// Aggregates npm download stats for every package maintained by the user and
// emits shields.io "endpoint" badge JSON into the output dir (published to the
// `output` branch by the daily README workflow). No package list is hardcoded:
// packages are discovered from the npm registry, so new publishes appear on the
// profile automatically.
import { writeFile, mkdir } from 'node:fs/promises'

const MAINTAINER = process.env.NPM_MAINTAINER || 'quotentiroler'
const OUT_DIR = process.env.OUT_DIR || 'dist'
const NPM_RED = 'cb0000'
const PAGE = 250

const nf = new Intl.NumberFormat('en-US')

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': `${MAINTAINER}-profile-stats` } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

// Discover all package names where the user is a maintainer, paging through results.
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

// Downloads in the last 30 days. Missing/unpublished packages count as 0 rather
// than failing the whole run.
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
const stats = await Promise.all(
  packages.map(async (name) => ({ name, downloads: await monthlyDownloads(name) })),
)
stats.sort((a, b) => b.downloads - a.downloads)

const total = stats.reduce((sum, p) => sum + p.downloads, 0)
const leader = stats[0] ?? { name: 'n/a', downloads: 0 }

// shields.io endpoint schema: https://shields.io/badges/endpoint-badge
const badges = {
  'npm-total.json': {
    schemaVersion: 1,
    label: 'npm downloads',
    message: `${nf.format(total)} / month`,
    color: NPM_RED,
    namedLogo: 'npm',
  },
  'npm-leader.json': {
    schemaVersion: 1,
    label: '🏆 top package',
    message: `${leader.name} · ${nf.format(leader.downloads)}/mo`,
    color: NPM_RED,
    namedLogo: 'npm',
  },
}

await mkdir(OUT_DIR, { recursive: true })
for (const [file, body] of Object.entries(badges)) {
  await writeFile(`${OUT_DIR}/${file}`, JSON.stringify(body))
}

console.log(
  `npm-stats: ${stats.length} packages, ${total}/mo total, leader ${leader.name} (${leader.downloads}/mo)`,
)
