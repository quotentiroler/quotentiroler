import { githubGraphql } from './lib/http.mjs'
import { nf, writeBadge } from './lib/badge.mjs'
import { KINDS, isListedRepo, trailingWindow, fetchProfile, fetchContributionsByRepository } from './lib/contributions.mjs'

const WINDOW_DAYS = Number(process.env.LOC_WINDOW_DAYS || 365)
const MAX_COMMIT_LINES = Number(process.env.LOC_MAX_COMMIT_LINES || 5000)
const EMERALD = '10b981'

const HISTORY_QUERY = `query($owner: String!, $name: String!, $author: ID!, $since: GitTimestamp!, $until: GitTimestamp!, $after: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, after: $after, since: $since, until: $until, author: { id: $author }) {
            pageInfo { hasNextPage endCursor }
            nodes { additions deletions parents { totalCount } }
          }
        }
      }
    }
  }
}`

async function authoredCommits(nameWithOwner, author, window) {
  const [owner, name] = nameWithOwner.split('/')
  const commits = []
  let after = null
  do {
    const data = await githubGraphql(HISTORY_QUERY, { owner, name, author, since: window.from, until: window.to, after })
    const history = data.repository?.defaultBranchRef?.target?.history
    if (!history) break
    commits.push(...history.nodes)
    after = history.pageInfo.hasNextPage ? history.pageInfo.endCursor : null
  } while (after)
  return commits
}

const isCountedCommit = (c) => c.parents.totalCount < 2 && c.additions + c.deletions <= MAX_COMMIT_LINES

const period = trailingWindow(WINDOW_DAYS)
const { id } = await fetchProfile()
const collection = await fetchContributionsByRepository(period, [KINDS.commits])
const repos = collection[KINDS.commits].map((r) => r.repository).filter(isListedRepo)
const commits = (await Promise.all(repos.map((r) => authoredCommits(r.nameWithOwner, id, period)))).flat()
const counted = commits.filter(isCountedCommit)

const added = counted.reduce((sum, c) => sum + c.additions, 0)
const deleted = counted.reduce((sum, c) => sum + c.deletions, 0)
const perDay = (n) => nf.format(Math.round(n / WINDOW_DAYS))

await writeBadge('loc-per-day', {
  label: `lines per day (${WINDOW_DAYS}d)`,
  message: `+${perDay(added)} / −${perDay(deleted)}`,
  color: EMERALD,
  namedLogo: 'git',
})

console.log(
  `loc-stats: ${repos.length} repos, ${counted.length}/${commits.length} commits counted, +${added} -${deleted} over ${WINDOW_DAYS}d`,
)
