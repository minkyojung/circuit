/**
 * GitHub OAuth Authentication Service
 *
 * Handles OAuth flow for GitHub authentication:
 * 1. Opens OAuth window
 * 2. Exchanges authorization code for access token
 * 3. Stores token securely
 */

import { BrowserWindow } from 'electron'
import Store from 'electron-store'

// GitHub OAuth configuration from environment variables
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3456/auth/github/callback'

// Token storage
const authStore = new Store({
  name: 'github-auth',
  defaults: {
    accessToken: null,
    expiresAt: null
  }
})

/**
 * GitHub API Response Types
 */
interface GitHubTokenResponse {
  access_token: string
  token_type: string
  scope: string
}

interface GitHubUser {
  login: string
  id: number
  avatar_url: string
  name: string
  email: string
}

interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
  visibility: string | null
}

/**
 * Start OAuth flow by opening GitHub authorization window
 */
export function startGitHubOAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!GITHUB_CLIENT_ID) {
      reject(new Error('GITHUB_CLIENT_ID not configured in .env'))
      return
    }

    // Build OAuth authorization URL
    const authUrl = new URL('https://github.com/login/oauth/authorize')
    authUrl.searchParams.append('client_id', GITHUB_CLIENT_ID)
    authUrl.searchParams.append('scope', 'repo,user')
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI)

    console.log('[GitHub OAuth] Opening authorization window...')
    console.log('[GitHub OAuth] Auth URL:', authUrl.toString())

    // Create OAuth window
    const authWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      title: 'Login with GitHub'
    })

    authWindow.loadURL(authUrl.toString())

    // Store resolve/reject for callback handler
    // This will be called by the webhook callback route
    ;(global as any).githubOAuthCallback = { resolve, reject, window: authWindow }

    // Handle window close (user cancelled)
    authWindow.on('closed', () => {
      if ((global as any).githubOAuthCallback) {
        delete (global as any).githubOAuthCallback
        reject(new Error('Authentication cancelled by user'))
      }
    })
  })
}

/**
 * Exchange authorization code for access token
 * Called by the webhook callback route
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  console.log('[GitHub OAuth] Exchanging code for token...')

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    throw new Error('GitHub OAuth credentials not configured')
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI
      })
    })

    if (!response.ok) {
      throw new Error(`GitHub token exchange failed: ${response.statusText}`)
    }

    const data = await response.json() as GitHubTokenResponse

    if (!data.access_token) {
      throw new Error('No access token in response')
    }

    // Store token
    authStore.set('accessToken', data.access_token)
    console.log('[GitHub OAuth] ✅ Token obtained and stored')

    return data.access_token
  } catch (error) {
    console.error('[GitHub OAuth] Token exchange error:', error)
    throw error
  }
}

/**
 * Complete OAuth flow after receiving callback
 * This is called by the webhook route
 */
export async function completeGitHubOAuth(code: string): Promise<void> {
  try {
    const token = await exchangeCodeForToken(code)

    // Resolve the pending promise
    const callback = (global as any).githubOAuthCallback
    if (callback) {
      callback.resolve(token)
      callback.window.close()
      delete (global as any).githubOAuthCallback
    }
  } catch (error) {
    const callback = (global as any).githubOAuthCallback
    if (callback) {
      callback.reject(error)
      callback.window.close()
      delete (global as any).githubOAuthCallback
    }
    throw error
  }
}

/**
 * Get stored access token
 */
export function getStoredToken(): string | null {
  return authStore.get('accessToken') as string | null
}

/**
 * Clear stored token (logout)
 */
export function clearToken(): void {
  authStore.delete('accessToken')
  console.log('[GitHub OAuth] Token cleared')
}

/**
 * Fetch user's GitHub repositories
 */
export async function fetchGitHubRepositories(accessToken: string): Promise<any[]> {
  console.log('[GitHub API] Fetching user repositories...')

  try {
    const response = await fetch(
      'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Octave'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`)
    }

    const repos = await response.json() as any[]

    console.log(`[GitHub API] ✅ Fetched ${repos.length} repositories`)

    return repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      htmlUrl: repo.html_url,
      private: repo.private,
      stars: repo.stargazers_count,
      language: repo.language,
      updatedAt: repo.updated_at,
      defaultBranch: repo.default_branch
    }))
  } catch (error) {
    console.error('[GitHub API] Error fetching repositories:', error)
    throw error
  }
}

/**
 * Fetch user's email addresses from GitHub
 */
async function fetchGitHubEmails(accessToken: string): Promise<GitHubEmail[]> {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Octave'
    }
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`)
  }

  return await response.json() as GitHubEmail[]
}

/**
 * Fetch authenticated user info
 *
 * Note: Fetches both /user and /user/emails to get complete information
 * because /user only returns email if it's public
 */
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  console.log('[GitHub API] Fetching user info...')

  try {
    // Fetch user info and emails in parallel for performance
    const [userResponse, emails] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Octave'
        }
      }),
      fetchGitHubEmails(accessToken)
    ])

    if (!userResponse.ok) {
      throw new Error(`GitHub API error: ${userResponse.statusText}`)
    }

    const user = await userResponse.json() as GitHubUser

    // Find primary verified email
    const primaryEmail = emails.find(e => e.primary && e.verified)

    // Use primary email if available, fallback to public email from /user
    if (primaryEmail) {
      user.email = primaryEmail.email
    }

    console.log(`[GitHub API] ✅ User: ${user.login} (${user.email})`)

    return user
  } catch (error) {
    console.error('[GitHub API] Error fetching user:', error)
    throw error
  }
}
