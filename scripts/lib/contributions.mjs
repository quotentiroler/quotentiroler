import { PROFILE_USER, githubGraphql } from './http.mjs'

const PROFILE_REPO = `${PROFILE_USER}/${PROFILE_USER}`

export const KINDS = {
  commits: 'commitContributionsByRepository',
  prs: 'pullRequestContributionsByRepository',
  issues: 'issueContributionsByRepository',
  reviews: 'pullRequestReviewContributionsByRepository',
}

export function isProfileRepo(repository) {
  return repository.nameWithOwner === PROFILE_REPO
}

export function isListedRepo(repository) {
  return !repository.isPrivate && !isProfileRepo(repository)
}

export async function fetchProfile() {
  const { user } = await githubGraphql(
    'query($login: String!) { user(login: $login) { id createdAt } }',
    { login: PROFILE_USER },
  )
  return user
}

export async function fetchContributionsByRepository(window, kinds = Object.values(KINDS)) {
  const fields = kinds
    .map(
      (field) => `${field}(maxRepositories: 100) {
      repository { nameWithOwner url isPrivate }
      contributions { totalCount }
    }`,
    )
    .join('\n')
  const data = await githubGraphql(
    `query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) { contributionsCollection(from: $from, to: $to) { ${fields} } }
    }`,
    { login: PROFILE_USER, ...window },
  )
  return data.user.contributionsCollection
}
