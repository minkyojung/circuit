/**
 * Onboarding Service
 *
 * Handles the initial onboarding flow for new users:
 * 1. GitHub OAuth authentication (required)
 * 2. Environment check (Git, CLI)
 * 3. Repository selection (minimum 1 required)
 * 4. Repository cloning
 * 5. Git config synchronization
 * 6. GitHub CLI setup (optional)
 */

import { spawn } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'
import { EventEmitter } from 'events'
import {
  OnboardingState,
  OnboardingResult,
  EnvironmentStatus,
  GitStatus,
  GitConfigStatus,
  CLIStatus,
  Repository,
  GitHubUser,
  OnboardingProgress
} from './onboardingTypes'

const execAsync = promisify(exec)

/**
 * Onboarding Service
 *
 * Singleton service that manages the onboarding flow
 */
export class OnboardingService extends EventEmitter {
  private state: OnboardingState

  constructor() {
    super()
    this.state = {
      step: 1,
      completed: false,
      user: null,
      availableRepos: [],
      selectedRepos: [],
      clonedPath: null
    }
  }

  /**
   * Start the onboarding flow
   *
   * This is the main entry point. It orchestrates all onboarding steps.
   */
  async start(): Promise<OnboardingResult> {
    try {
      // Step 1: GitHub authentication is handled by the UI
      // (OAuth flow is triggered by user clicking "Continue with GitHub")

      // We'll implement the actual steps in the next phase
      throw new Error('Onboarding service not fully implemented yet')

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        canRetry: true
      }
    }
  }

  /**
   * Check environment (Git, Git config, GitHub CLI)
   */
  async checkEnvironment(): Promise<EnvironmentStatus> {
    const [git, gitConfig, cli] = await Promise.all([
      this.checkGit(),
      this.checkGitConfig(),
      this.checkGitHubCLI()
    ])

    return { git, gitConfig, cli }
  }

  /**
   * Check if Git is installed
   */
  private async checkGit(): Promise<GitStatus> {
    try {
      const { stdout } = await execAsync('git --version')
      const version = stdout.trim().replace('git version ', '')

      return {
        installed: true,
        version,
        status: 'ok'
      }
    } catch (error) {
      return {
        installed: false,
        status: 'error',
        message: 'Git is not installed. Please install Git to continue.'
      }
    }
  }

  /**
   * Check Git configuration (user.name, user.email)
   */
  private async checkGitConfig(): Promise<GitConfigStatus> {
    try {
      const [nameResult, emailResult] = await Promise.all([
        execAsync('git config --get user.name').catch(() => ({ stdout: '' })),
        execAsync('git config --get user.email').catch(() => ({ stdout: '' }))
      ])

      const name = nameResult.stdout.trim()
      const email = emailResult.stdout.trim()

      if (name && email) {
        return {
          configured: true,
          name,
          email,
          status: 'ok'
        }
      }

      return {
        configured: false,
        status: 'warning',
        message: 'Git config not set. We\'ll help you configure it.'
      }
    } catch (error) {
      return {
        configured: false,
        status: 'warning',
        message: 'Could not read Git config'
      }
    }
  }

  /**
   * Check GitHub CLI installation and authentication status
   *
   * IMPORTANT: Does NOT reinstall if already installed!
   *
   * Returns:
   * - action: 'none' if already installed and logged in (perfect state)
   * - action: 'login' if installed but not logged in
   * - action: 'install' if not installed
   */
  private async checkGitHubCLI(): Promise<CLIStatus> {
    try {
      // Check if CLI is installed
      const versionResult = await execAsync('gh --version')
      const version = this.parseGHVersion(versionResult.stdout)

      // Check authentication status
      try {
        const authResult = await execAsync('gh auth status', {
          encoding: 'utf8'
        })

        // gh auth status outputs to stderr (not an error, just how it works)
        const output = authResult.stdout + authResult.stderr
        const isLoggedIn = output.includes('Logged in to github.com')

        if (isLoggedIn) {
          const username = this.extractGHUsername(output)

          // ✅ Perfect state - installed and authenticated
          return {
            installed: true,
            version,
            authenticated: true,
            username,
            action: 'none',  // Do nothing!
            status: 'ok'
          }
        }

        // Installed but not logged in
        return {
          installed: true,
          version,
          authenticated: false,
          action: 'login',  // Suggest logging in
          status: 'warning',
          message: 'GitHub CLI is installed but not logged in'
        }
      } catch (authError) {
        // auth status command failed = not logged in
        return {
          installed: true,
          version,
          authenticated: false,
          action: 'login',
          status: 'warning',
          message: 'GitHub CLI is installed but not logged in'
        }
      }
    } catch (error) {
      // gh command not found = not installed
      return {
        installed: false,
        authenticated: false,
        action: 'install',  // Guide user to install
        status: 'info',
        message: 'GitHub CLI not found (optional feature)'
      }
    }
  }

  /**
   * Parse GitHub CLI version from output
   */
  private parseGHVersion(stdout: string): string {
    const match = stdout.match(/gh version ([\d.]+)/)
    return match ? match[1] : 'unknown'
  }

  /**
   * Extract username from gh auth status output
   */
  private extractGHUsername(output: string): string {
    const match = output.match(/Logged in to github\.com as ([^\s(]+)/)
    return match ? match[1] : 'unknown'
  }

  /**
   * Update current step and emit progress event
   */
  private updateStep(step: number, message: string, percent?: number) {
    this.state.step = step
    this.emit('progress', {
      stage: this.getStageForStep(step),
      percent: percent || (step / 8) * 100,
      message
    })
  }

  /**
   * Map step number to stage name
   */
  private getStageForStep(step: number): OnboardingProgress['stage'] {
    const stages: OnboardingProgress['stage'][] = [
      'auth',
      'env-check',
      'repos',
      'cloning',
      'config',
      'cli',
      'complete'
    ]
    return stages[Math.min(step - 1, stages.length - 1)]
  }

  /**
   * Clone repository with progress tracking
   *
   * @param repo Repository to clone
   * @param destination Local path to clone to
   * @param token GitHub OAuth token (for private repos)
   */
  async cloneRepository(
    repo: Repository,
    destination: string,
    token: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Build clone URL with token for authentication
      // Format: https://oauth2:TOKEN@github.com/owner/repo.git
      const cloneUrl = `https://oauth2:${token}@github.com/${repo.fullName}.git`

      console.log(`[Onboarding] Cloning ${repo.fullName} to ${destination}`)

      // Spawn git clone process
      const cloneProcess = spawn('git', [
        'clone',
        '--progress',  // Show progress
        cloneUrl,
        destination
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stderrData = ''

      // Git outputs progress to stderr (not an error!)
      cloneProcess.stderr.on('data', (data) => {
        stderrData += data.toString()

        // Parse progress from git output
        // Format: "Receiving objects: 45% (1234/2700)"
        const progressMatch = stderrData.match(/Receiving objects:\s+(\d+)%/)
        if (progressMatch) {
          const percent = parseInt(progressMatch[1])
          this.emit('clone-progress', {
            repo: repo.name,
            percent,
            stage: 'receiving'
          })
        }

        // Resolving deltas
        const deltaMatch = stderrData.match(/Resolving deltas:\s+(\d+)%/)
        if (deltaMatch) {
          const percent = parseInt(deltaMatch[1])
          this.emit('clone-progress', {
            repo: repo.name,
            percent,
            stage: 'resolving'
          })
        }
      })

      cloneProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`[Onboarding] ✅ Cloned ${repo.name}`)
          resolve()
        } else {
          const error = new Error(
            `Clone failed with code ${code}. Error: ${stderrData}`
          )
          console.error(`[Onboarding] ❌ Clone failed:`, error)
          reject(error)
        }
      })

      cloneProcess.on('error', (error) => {
        console.error(`[Onboarding] ❌ Clone process error:`, error)
        reject(error)
      })
    })
  }

  /**
   * Set Git config globally
   */
  async setGitConfig(name: string, email: string): Promise<void> {
    try {
      await execAsync(`git config --global user.name "${name}"`)
      await execAsync(`git config --global user.email "${email}"`)
      console.log(`[Onboarding] ✅ Git config updated: ${name} <${email}>`)
    } catch (error) {
      throw new Error(
        `Failed to set Git config: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Run gh auth login interactively
   *
   * This spawns an interactive process where the user can login to GitHub CLI
   */
  async runGHAuthLogin(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[Onboarding] Starting GitHub CLI authentication...')

      // Spawn interactive process
      // stdio: 'inherit' allows user to interact with the process
      const ghAuth = spawn('gh', ['auth', 'login'], {
        stdio: 'inherit'
      })

      ghAuth.on('close', (code) => {
        if (code === 0) {
          console.log('[Onboarding] ✅ GitHub CLI authenticated')
          resolve()
        } else {
          reject(new Error('GitHub CLI login cancelled or failed'))
        }
      })

      ghAuth.on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * Get current onboarding state
   */
  getState(): OnboardingState {
    return { ...this.state }
  }
}

// Singleton instance
let instance: OnboardingService | null = null

export function getOnboardingService(): OnboardingService {
  if (!instance) {
    instance = new OnboardingService()
  }
  return instance
}
