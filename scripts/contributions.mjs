import { PROFILE_USER, githubGraphql } from './lib/http.mjs'
import { replaceReadmeSection } from './lib/readme.mjs'

const README = process.env.README_PATH || 'README.md'
const KINDS = {
  commits: 'commitContributionsByRepository',
  prs: 'pullRequestContributionsByRepository',
  issues: 'issueContributionsByRepository',
  reviews: 'pullRequestReviewContributionsByRepository',
}

const nf = new Intl.NumberFormat('en-US')

const byRepoFields = Object.values(KINDS)
  .map(
    (field) => `${field}(maxRepositories: 100) {
      repository { nameWithOwner url isPrivate }
      contributions { totalCount }
    }`,
  )
  .join('\n')

const YEAR_QUERY = `query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) { ${byRepoFields} }
  }
}`

function yearWindows(createdAt, now = new Date()) {
  const windows = []
  for (let from = new Date(createdAt); from < now; ) {
    const to = new Date(from)
    to.setUTCFullYear(to.getUTCFullYear() + 1)
    windows.push({ from: from.toISOString(), to: (to < now ? to : now).toISOString() })
    from = to
  }
  return windows
}

async function collectContributions() {
  const { user } = await githubGraphql(
    'query($login: String!) { user(login: $login) { createdAt } }',
    { login: PROFILE_USER },
  )
  const collections = await Promise.all(
    yearWindows(user.createdAt).map(async (w) => {
      const data = await githubGraphql(YEAR_QUERY, { login: PROFILE_USER, ...w })
      return data.user.contributionsCollection
    }),
  )

  const repos = new Map()
  for (const collection of collections) {
    for (const [kind, field] of Object.entries(KINDS)) {
      for (const { repository, contributions } of collection[field]) {
        if (repository.isPrivate) continue
        const row = repos.get(repository.nameWithOwner) ?? {
          name: repository.nameWithOwner,
          url: repository.url,
          commits: 0,
          prs: 0,
          issues: 0,
          reviews: 0,
          total: 0,
        }
        row[kind] += contributions.totalCount
        row.total += contributions.totalCount
        repos.set(row.name, row)
      }
    }
  }
  return [...repos.values()].filter((r) => r.commits > 0).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

function renderTable(rows) {
  const lines = [
    '| # | Repository | Commits | PRs | Issues | Reviews | Total |',
    '|--:|:-----------|--------:|----:|-------:|--------:|------:|',
    ...rows.map(
      (r, i) =>
        `| ${i + 1} | [${r.name}](${r.url}) | ${nf.format(r.commits)} | ${nf.format(r.prs)} | ${nf.format(r.issues)} | ${nf.format(r.reviews)} | **${nf.format(r.total)}** |`,
    ),
  ]
  return lines.join('\n')
}

const rows = await collectContributions()
const changed = await replaceReadmeSection(README, 'contributions', renderTable(rows))
console.log(`contributions: ${rows.length} public repos, README ${changed ? 'updated' : 'unchanged'}`)
