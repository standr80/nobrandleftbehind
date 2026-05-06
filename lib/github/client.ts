import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

/**
 * Returns an Octokit client authenticated as the GitHub App installation
 * for a specific tenant. installationId is stored per-tenant in the DB.
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
