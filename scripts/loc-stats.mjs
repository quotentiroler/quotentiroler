import { CAN_READ_PRIVATE, githubGraphql, mapConcurrent } from './lib/http.mjs'
import { nf, writeBadge } from './lib/badge.mjs'
import { trailingWindow } from './lib/dates.mjs'
import { KINDS, isProfileRepo, fetchProfile, fetchContributionsByRepository } from './lib/contributions.mjs'

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

const PRIVATE_REPOS_QUERY = `query($after: String) {
  viewer {
    repositories(first: 100, after: $after, privacy: PRIVATE, affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], orderBy: { field: PUSHED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { nameWithOwner isPrivate pushedAt }
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

async function privateReposPushedSince(since) {
  const repos = []
  let after = null
  do {
    const { viewer } = await githubGraphql(PRIVATE_REPOS_QUERY, { after })
    const { nodes, pageInfo } = viewer.repositories
    const recent = nodes.filter((r) => r.pushedAt && r.pushedAt >= since)
    repos.push(...recent)
    after = pageInfo.hasNextPage && recent.length === nodes.length ? pageInfo.endCursor : null
  } while (after)
  return repos
}

async function reposToScan(period) {
  const collection = await fetchContributionsByRepository(period, [KINDS.commits])
  const contributed = collection[KINDS.commits].map((r) => r.repository)
  const scanned = CAN_READ_PRIVATE ? [...contributed, ...(await privateReposPushedSince(period.from))] : contributed
  const unique = new Map(scanned.map((r) => [r.nameWithOwner, r]))
  return [...unique.values()].filter((r) => !isProfileRepo(r) && (CAN_READ_PRIVATE || !r.isPrivate))
}

const isCountedCommit = (c) => c.parents.totalCount < 2 && c.additions + c.deletions <= MAX_COMMIT_LINES

const period = trailingWindow(WINDOW_DAYS)
const { id } = await fetchProfile()
const repos = await reposToScan(period)
const commits = (await mapConcurrent(repos, (r) => authoredCommits(r.nameWithOwner, id, period))).flat()
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
  `loc-stats: ${repos.length} repos (${CAN_READ_PRIVATE ? 'public + private' : 'public only'}), ${counted.length}/${commits.length} commits counted, +${added} -${deleted} over ${WINDOW_DAYS}d`,
)
