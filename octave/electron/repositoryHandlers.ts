/**
 * IPC Handlers for Repository Management
 *
 * Handles frontend requests for repository listing, creation, cloning, and removal.
 * Uses electron-store for persistent storage and automatic validation/cleanup.
 */

import { ipcMain, dialog, app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { nanoid } from 'nanoid'
// @ts-ignore - simple-git types might not be available
import simpleGit from 'simple-git'
// @ts-ignore - electron-store types might not be available
import Store from 'electron-store'

interface Repository {
  id: string
  name: string
  path: string
  remoteUrl: string | null
  defaultBranch: string
  createdAt: string
}

// ============================================================================
// Repository Store - Persistent storage for repository data
// ============================================================================
const repositoryStore = new Store({
  name: 'repositories',
  defaults: {
    repositories: []
  }
})

/**
 * Helper: Load repositories from electron-store with validation
 * Automatically removes invalid entries (.app bundles, non-existent paths, non-git dirs)
 */
async function loadRepositories(): Promise<{ success: boolean; repositories?: Repository[]; error?: string }> {
  try {
    const repositories: Repository[] = repositoryStore.get('repositories', [])
    console.log('[RepositoryHandlers] Loading repositories:', repositories.length)

    // Validate each repository
    const validRepositories: Repository[] = []
    let hasInvalidEntries = false

    for (const repo of repositories) {
      // Filter 1: Reject .app bundles
      if (repo.path && repo.path.endsWith('.app')) {
        console.warn(`[RepositoryHandlers] Removed .app bundle: ${repo.path}`)
        hasInvalidEntries = true
        continue
      }

      // Filter 2: Check if path exists
      try {
        await fs.access(repo.path)
      } catch {
        console.warn(`[RepositoryHandlers] Removed non-existent path: ${repo.path}`)
        hasInvalidEntries = true
        continue
      }

      // Filter 3: Verify it's a git repository
      const gitPath = path.join(repo.path, '.git')
      try {
        await fs.access(gitPath)
        validRepositories.push(repo)
      } catch {
        console.warn(`[RepositoryHandlers] Removed non-git directory: ${repo.path}`)
        hasInvalidEntries = true
      }
    }

    // Auto-cleanup: Save cleaned list if we found invalid entries
    if (hasInvalidEntries) {
      repositoryStore.set('repositories', validRepositories)
      console.log(`[RepositoryHandlers] Cleaned up invalid entries. ${validRepositories.length}/${repositories.length} valid`)
    }

    return { success: true, repositories: validRepositories }
  } catch (error: any) {
    console.error('[RepositoryHandlers] Error loading repositories:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Helper: Save repositories to electron-store
 */
async function saveRepositories(repositories: Repository[]): Promise<void> {
  repositoryStore.set('repositories', repositories)
}

/**
 * Helper: Auto-register project path as repository if not already registered
 */
export async function autoRegisterProjectPath(projectPath: string): Promise<void> {
  try {
    console.log('[RepositoryHandlers] Auto-registering project path:', projectPath)

    // Load existing repositories
    const listResult = await loadRepositories()
    const repositories = listResult.repositories || []

    // Check if this path is already registered
    const existing = repositories.find(r => r.path === projectPath)
    if (existing) {
      console.log('[RepositoryHandlers] Project path already registered:', existing.name)
      return
    }

    // Don't auto-register .app bundles
    if (projectPath.endsWith('.app')) {
      console.warn('[RepositoryHandlers] Skipping auto-register for .app bundle:', projectPath)
      return
    }

    // Get repository name from path
    const repoName = path.basename(projectPath)

    // Check if it's a valid git repository
    const simpleGit = (await import('simple-git')).default
    const git = simpleGit(projectPath)

    let isRepo = false
    try {
      isRepo = await git.checkIsRepo()
    } catch (e) {
      console.warn('[RepositoryHandlers] Not a git repository:', projectPath)
      // Still register it even if not a git repo (user can initialize git later)
    }

    // Get git info if it's a git repo
    let remoteUrl: string | null = null
    let defaultBranch = 'main'

    if (isRepo) {
      try {
        const remotes = await git.getRemotes(true)
        remoteUrl = remotes.length > 0 ? remotes[0].refs.fetch : null

        const branches = await git.branch()
        defaultBranch = branches.current || 'main'
      } catch (e) {
        console.warn('[RepositoryHandlers] Could not get git info:', e)
      }
    }

    // Create repository object
    const repository: Repository = {
      id: nanoid(),
      name: repoName,
      path: projectPath,
      remoteUrl,
      defaultBranch,
      createdAt: new Date().toISOString()
    }

    // Add to repositories
    repositories.push(repository)

    // Save to store
    await saveRepositories(repositories)

    console.log('[RepositoryHandlers] Project path auto-registered:', repository.name)
  } catch (error: any) {
    console.error('[RepositoryHandlers] Error auto-registering project path:', error)
  }
}

/**
 * Register all repository-related IPC handlers
 */
export function registerRepositoryHandlers(): void {
  console.log('[RepositoryHandlers] Registering IPC handlers...')

  /**
   * List all repositories with validation
   */
  ipcMain.handle('repository:list', async () => {
    try {
      return await loadRepositories()
    } catch (error: any) {
      console.error('[RepositoryHandlers] Error listing repositories:', error)
      return { success: false, error: error.message, repositories: [] }
    }
  })

  /**
   * Select folder for adding repository
   * Opens native folder picker dialog
   */
  ipcMain.handle('repository:select-folder', async () => {
    try {
      console.log('[RepositoryHandlers] Opening folder selection dialog')

      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Git Repository Folder',
        message: 'Choose a folder containing a Git repository'
      })

      if (result.canceled || result.filePaths.length === 0) {
        return {
          success: false,
          cancelled: true
        }
      }

      const folderPath = result.filePaths[0]
      console.log('[RepositoryHandlers] Selected folder:', folderPath)

      return {
        success: true,
        folderPath
      }
    } catch (error: any) {
      console.error('[RepositoryHandlers] Error selecting folder:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  /**
   * Add a new repository
   * Validates path and prevents duplicates
   */
  ipcMain.handle('repository:add', async (event, folderPath: string) => {
    try {
      console.log('[RepositoryHandlers] Adding repository:', folderPath)

      // Validation 1: Reject .app bundles
      if (folderPath.endsWith('.app')) {
        return {
          success: false,
          error: 'Cannot add application bundles (.app) as repositories'
        }
      }

      // Validation 2: Verify it's a git repository
      const gitPath = path.join(folderPath, '.git')
      try {
        await fs.access(gitPath)
      } catch {
        return {
          success: false,
          error: 'Not a valid Git repository (no .git directory found)'
        }
      }

      // Get repository metadata using simple-git
      const git = simpleGit(folderPath)
      let defaultBranch = 'main'
      let remoteUrl: string | null = null

      try {
        const branches = await git.branch()
        defaultBranch = branches.current || 'main'
      } catch (err) {
        console.warn('[RepositoryHandlers] Could not determine default branch:', err)
      }

      try {
        const remotes = await git.getRemotes(true)
        remoteUrl = remotes.length > 0 ? remotes[0].refs.fetch : null
      } catch (err) {
        console.warn('[RepositoryHandlers] Could not get remote URL:', err)
      }

      // Load existing repositories
      const listResult = await loadRepositories()
      const repositories = listResult.repositories || []

      // Check for duplicates
      const duplicate = repositories.find(r => r.path === folderPath)
      if (duplicate) {
        return {
          success: false,
          error: 'Repository already exists in the list'
        }
      }

      // Create new repository entry
      const newRepository: Repository = {
        id: nanoid(),
        name: path.basename(folderPath),
        path: folderPath,
        defaultBranch,
        remoteUrl,
        createdAt: new Date().toISOString()
      }

      // Save to store
      repositories.push(newRepository)
      await saveRepositories(repositories)

      console.log('[RepositoryHandlers] Successfully added:', newRepository.name)
      return {
        success: true,
        repository: newRepository
      }
    } catch (error: any) {
      console.error('[RepositoryHandlers] Error adding repository:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  /**
   * Remove a repository from the list
   * Does not delete files, only removes from tracking
   */
  ipcMain.handle('repository:remove', async (event, repositoryId: string) => {
    try {
      console.log('[RepositoryHandlers] Removing repository:', repositoryId)

      const listResult = await loadRepositories()
      const repositories = listResult.repositories || []

      const repository = repositories.find(r => r.id === repositoryId)
      if (!repository) {
        return {
          success: false,
          error: 'Repository not found'
        }
      }

      // Remove from list
      const updatedRepositories = repositories.filter(r => r.id !== repositoryId)
      await saveRepositories(updatedRepositories)

      console.log('[RepositoryHandlers] Successfully removed:', repository.name)
      return { success: true }
    } catch (error: any) {
      console.error('[RepositoryHandlers] Error removing repository:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  /**
   * Create new repository (kept for compatibility, uses select-folder + add flow)
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
      console.log('[RepositoryHandlers] Adding repository:', repoPath)

      // Validation 1: Reject .app bundles
      if (repoPath.endsWith('.app')) {
        return {
          success: false,
          error: 'Cannot add application bundles (.app) as repositories'
        }
      }

      // Validation 2: Verify it's a git repository
      const git = simpleGit(repoPath)
      const isRepo = await git.checkIsRepo()
      if (!isRepo) {
        return { success: false, error: 'Selected directory is not a Git repository' }
      }

      // Get repository metadata
      let defaultBranch = 'main'
      let remoteUrl: string | null = null

      try {
        const branches = await git.branch()
        defaultBranch = branches.current || 'main'
      } catch (err) {
        console.warn('[RepositoryHandlers] Could not determine default branch:', err)
      }

      try {
        const remotes = await git.getRemotes(true)
        remoteUrl = remotes.length > 0 ? remotes[0].refs.fetch : null
      } catch (err) {
        console.warn('[RepositoryHandlers] Could not get remote URL:', err)
      }

      // Load existing repositories
      const listResult = await loadRepositories()
      const repositories = listResult.repositories || []

      // Check for duplicates
      const duplicate = repositories.find(r => r.path === repoPath)
      if (duplicate) {
        return { success: false, error: 'Repository already exists' }
      }

      // Create repository object
      const repository: Repository = {
        id: nanoid(),
        name: path.basename(repoPath),
        path: repoPath,
        remoteUrl,
        defaultBranch,
        createdAt: new Date().toISOString()
      }

      // Add and save
      repositories.push(repository)
      await saveRepositories(repositories)

      console.log('[RepositoryHandlers] Repository created:', repository.name)
      return { success: true, repository }
    } catch (error: any) {
      console.error('[RepositoryHandlers] Error creating repository:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Clone repository from Git URL
   */
  ipcMain.handle('repository:clone', async (event, gitUrl: string) => {
    try {
      // Open directory picker for clone destination
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Clone Destination',
        message: 'Choose where to clone the repository'
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'User canceled selection' }
      }

      const parentPath = result.filePaths[0]

      // Extract repository name from URL
      // e.g., https://github.com/user/repo.git -> repo
      const urlMatch = gitUrl.match(/\/([^\/]+?)(\.git)?$/)
      if (!urlMatch) {
        return { success: false, error: 'Invalid Git URL format' }
      }

      const repoName = urlMatch[1]
      const repoPath = path.join(parentPath, repoName)

      // Check if directory already exists
      const pathExists = await fs.access(repoPath).then(() => true).catch(() => false)
      if (pathExists) {
        return { success: false, error: `Directory ${repoName} already exists` }
      }

      // Clone the repository
      console.log(`[RepositoryHandlers] Cloning ${gitUrl} to ${repoPath}...`)
      const git = simpleGit(parentPath)
      await git.clone(gitUrl, repoName)

      // Get repository info from cloned repo
      const clonedGit = simpleGit(repoPath)
      const remotes = await clonedGit.getRemotes(true)
      const remoteUrl = remotes.length > 0 ? remotes[0].refs.fetch : gitUrl

      // Get default branch
      let defaultBranch = 'main'
      try {
        const branches = await clonedGit.branch()
        defaultBranch = branches.current || 'main'
      } catch (e) {
        console.warn('[RepositoryHandlers] Could not determine default branch:', e)
      }

      // Create repository object
      const repository: Repository = {
        id: nanoid(),
        name: repoName,
        path: repoPath,
        remoteUrl,
        defaultBranch,
        createdAt: new Date().toISOString()
      }

      // Load existing repositories
      const listResult = await loadRepositories()
      const repositories = listResult.repositories || []

      // Add new repository
      repositories.push(repository)

      // Save to store
      await saveRepositories(repositories)

      console.log('[RepositoryHandlers] Repository cloned:', repository.name)
      return { success: true, repository }
    } catch (error: any) {
      console.error('[RepositoryHandlers] Error cloning repository:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Delete repository (alias for remove, kept for compatibility)
   */
  ipcMain.handle('repository:delete', async (event, repositoryId: string) => {
    try {
      console.log('[RepositoryHandlers] Deleting repository:', repositoryId)

      const listResult = await loadRepositories()
      const repositories = listResult.repositories || []

      const repository = repositories.find(r => r.id === repositoryId)
      if (!repository) {
        return {
          success: false,
          error: 'Repository not found'
        }
      }

      // Remove from list
      const updatedRepositories = repositories.filter(r => r.id !== repositoryId)
      await saveRepositories(updatedRepositories)

      console.log('[RepositoryHandlers] Repository removed:', repository.name)
      return { success: true }
    } catch (error: any) {
      console.error('[RepositoryHandlers] Error deleting repository:', error)
      return {
        success: false,
        error: error.message
      }
    }
  })

  console.log('[RepositoryHandlers] All IPC handlers registered')
}
