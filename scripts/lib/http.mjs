export const PROFILE_USER = process.env.PROFILE_USER || 'quotentiroler'
export const CAN_READ_PRIVATE = Boolean(process.env.PROFILE_STATS_TOKEN)

const GITHUB_TOKEN = process.env.PROFILE_STATS_TOKEN || process.env.GITHUB_TOKEN
const MAX_ATTEMPTS = Number(process.env.HTTP_MAX_ATTEMPTS || 4)
const CONCURRENCY = Number(process.env.HTTP_CONCURRENCY || 4)
const RETRYABLE = new Set([429, 500, 502, 503, 504])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function retryDelay(res, attempt) {
  const retryAfter = Number(res?.headers.get('retry-after'))
  return retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt
}

export async function fetchJson(url, init = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { 'user-agent': `${PROFILE_USER}-profile-stats`, ...init.headers },
    }).catch((error) => {
      if (attempt >= MAX_ATTEMPTS) throw error
      return null
    })
    if (res?.ok) return res.json()
    if (res && (!RETRYABLE.has(res.status) || attempt >= MAX_ATTEMPTS)) {
      throw new Error(`${res.status} ${res.statusText} for ${url}`)
    }
    const delay = retryDelay(res, attempt)
    console.warn(`retry ${attempt}/${MAX_ATTEMPTS - 1} in ${delay}ms: ${res ? res.status : 'network error'} for ${url}`)
    await sleep(delay)
  }
}

export async function mapConcurrent(items, fn, limit = CONCURRENCY) {
  const results = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export async function githubGraphql(query, variables = {}) {
  if (!GITHUB_TOKEN) throw new Error('PROFILE_STATS_TOKEN or GITHUB_TOKEN is required for GitHub GraphQL requests')
  const body = await fetchJson('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${GITHUB_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '))
  return body.data
}
