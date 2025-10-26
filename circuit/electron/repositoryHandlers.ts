/**
 * IPC Handlers for Repository Management
 *
 * Handles frontend requests for repository listing, creation, and switching.
 */

import { ipcMain, dialog, app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
// @ts-ignore - simple-git types might not be available
import simpleGit from 'simple-git'

interface Repository {
  id: string
  name: string
  path: string
  remoteUrl: string | null
  defaultBranch: string
  createdAt: string
}

const CONFIG_PATH = path.join(app.getPath('userData'), 'repositories.json')

/**
 * Helper: Load repositories from config
 */
async function loadRepositories(): Promise<{ success: boolean; repositories?: Repository[]; error?: string }> {
  try {
    const configExists = await fs.access(CONFIG_PATH).then(() => true).catch(() => false)

    if (!configExists) {
      return { success: true, repositories: [] }
    }

    const data = await fs.readFile(CONFIG_PATH, 'utf-8')
    const repositories: Repository[] = JSON.parse(data)
    return { success: true, repositories }
  } catch (error: any) {
    console.error('[RepositoryHandlers] Error loading repositories:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Helper: Save repositories to config
 */
async function saveRepositories(repositories: Repository[]): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(repositories, null, 2), 'utf-8')
}

/**
 * Register all repository-related IPC handlers
 */
export function registerRepositoryHandlers(): void {
  console.log('[RepositoryHandlers] Registering IPC handlers...')

  /**
   * List all repositories
   */
  ipcMain.handle('repository:list', async () => {
    try {
      return await loadRepositories()
    } catch (error: any) {
      console.error('[RepositoryHandlers] Error listing repositories:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Create new repository
   */
  ipcMain.handle('repository:create', async (event) => {
    try {
      // Open directory picker dialog
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Repository Directory',
        message: 'Choose a Git repository directory to add'
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'User canceled selection' }
      }

      const repoPath = result.filePaths[0]
      const git = simpleGit(repoPath)

      // Check if it's a valid git repository
      const isRepo = await git.checkIsRepo()
      if (!isRepo) {
        return { success: false, error: 'Selected directory is not a Git repository' }
      }

      // Get repository info
      const remotes = await git.getRemotes(true)
      const remoteUrl = remotes.length > 0 ? remotes[0].refs.fetch : null

      // Get default branch
      let defaultBranch = 'main'
      try {
        const branches = await git.branch()
        defaultBranch = branches.current || 'main'
      } catch (e) {
        console.warn('[RepositoryHandlers] Could not determine default branch:', e)
      }

      // Create repository object
      const repository: Repository = {
        id: uuidv4(),
        name: path.basename(repoPath),
        path: repoPath,
        remoteUrl,
        defaultBranch,
        createdAt: new Date().toISOString()
      }

      // Load existing repositories
      const listResult = await loadRepositories()
      const repositories = listResult.repositories || []

      // Check for duplicates
      const duplicate = repositories.find(r => r.path === repoPath)
      if (duplicate) {
        return { success: false, error: 'Repository already exists' }
      }

      // Add new repository
      repositories.push(repository)

      // Save to config
      await saveRepositories(repositories)

      console.log('[RepositoryHandlers] Repository created:', repository.name)
      return { success: true, repository }
    } catch (error: any) {
      console.error('[RepositoryHandlers] Error creating repository:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Delete repository (removes from list, doesn't delete files)
   */
  ipcMain.handle('repository:delete', async (event, repositoryId: string) => {
    try {
      const listResult = await loadRepositories()
      const repositories = listResult.repositories || []

      const repository = repositories.find(r => r.id === repositoryId)
      if (!repository) {
        return { success: false, error: 'Repository not found' }
      }

      // Remove from list
      const updatedRepositories = repositories.filter(r => r.id !== repositoryId)
      await saveRepositories(updatedRepositories)

      console.log('[RepositoryHandlers] Repository removed:', repository.name)
      return { success: true }
    } catch (error: any) {
      console.error('[RepositoryHandlers] Error deleting repository:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[RepositoryHandlers] All IPC handlers registered')
}
