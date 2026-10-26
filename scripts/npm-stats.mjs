import { PROFILE_USER, fetchJson, mapConcurrent } from './lib/http.mjs'
import { nf, writeBadge } from './lib/badge.mjs'
import { completedDaysWindow } from './lib/dates.mjs'

const MAINTAINER = process.env.NPM_MAINTAINER || PROFILE_USER
const WINDOW_DAYS = Number(process.env.NPM_WINDOW_DAYS || 30)
const NPM_RED = 'cb0000'
const PAGE = 250

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

async function downloads(pkg, { start, end }) {
  try {
    const data = await fetchJson(
      `https://api.npmjs.org/downloads/point/${start}:${end}/${encodeURIComponent(pkg)}`,
    )
    return data.downloads ?? 0
  } catch {
    return 0
  }
}

const packages = await discoverPackages()
const period = completedDaysWindow(WINDOW_DAYS)
const counts = await mapConcurrent(packages, (pkg) => downloads(pkg, period))
const total = counts.reduce((sum, n) => sum + n, 0)

await writeBadge('npm-total', {
  label: 'npm downloads',
  message: `${nf.format(total)} / month`,
  color: NPM_RED,
  namedLogo: 'npm',
})

console.log(`npm-stats: ${packages.length} packages, ${total} downloads ${period.start}..${period.end}`)
