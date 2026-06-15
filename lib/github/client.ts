import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

/**
 * Returns an Octokit client authenticated via a Personal Access Token (PAT).
 * This is the preferred approach for single-tenant git integrations.
 */
export function getOctokitForToken(token: string): Octokit {
  return new Octokit({ auth: token })
}

/**
 * Returns an Octokit client authenticated as a GitHub App installation.
 * Used when cms_type='git' and the tenant has a GitHub App installation
 * rather than a PAT. Requires GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY env vars.
 */
export function getOctokitForTenant(installationId: number): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      installationId,
    },
  })
}
