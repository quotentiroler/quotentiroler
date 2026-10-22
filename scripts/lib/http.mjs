export const PROFILE_USER = process.env.PROFILE_USER || 'quotentiroler'

export async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'user-agent': `${PROFILE_USER}-profile-stats`, ...init.headers },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

export async function githubGraphql(query, variables = {}) {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is required for GitHub GraphQL requests')
  const body = await fetchJson('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '))
  return body.data
}
