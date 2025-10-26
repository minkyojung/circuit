# Repository IPC Handler Implementation Guide

## Overview

This guide explains how to implement the backend IPC handlers for repository management functionality. The frontend has been updated to call these handlers, but they need to be implemented in the Electron main process.

## Required IPC Handlers

### 1. `repository:list`

Lists all repositories configured in the application.

**Location:** `circuit/electron/workspaceHandlers.ts` (or create `circuit/electron/repositoryHandlers.ts`)

**Request:**
```typescript
ipcMain.handle('repository:list', async () => {
  // Implementation
})
```

**Response:**
```typescript
interface RepositoryListResult {
  success: boolean
  repositories?: Repository[]
  error?: string
}
```

**Implementation Example:**
```typescript
import { ipcMain } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

// Configuration file location
const CONFIG_PATH = path.join(app.getPath('userData'), 'repositories.json')

ipcMain.handle('repository:list', async () => {
  try {
    // Read repositories from config file
    const configExists = await fs.access(CONFIG_PATH).then(() => true).catch(() => false)

    if (!configExists) {
      // Return empty list or create default repository
      return {
        success: true,
        repositories: []
      }
    }

    const data = await fs.readFile(CONFIG_PATH, 'utf-8')
    const repositories: Repository[] = JSON.parse(data)

    return {
      success: true,
      repositories
    }
  } catch (error) {
    console.error('Error listing repositories:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
```

---

### 2. `repository:create`

Creates a new repository by prompting the user to select a directory.

**Request:**
```typescript
ipcMain.handle('repository:create', async () => {
  // Implementation
})
```

**Response:**
```typescript
interface RepositoryCreateResult {
  success: boolean
  repository?: Repository
  error?: string
}
```

**Implementation Example:**
```typescript
import { dialog } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import simpleGit from 'simple-git'

ipcMain.handle('repository:create', async (event) => {
  try {
    // Open directory picker dialog
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Repository Directory'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return {
        success: false,
        error: 'User canceled selection'
      }
    }

    const repoPath = result.filePaths[0]
    const git = simpleGit(repoPath)

    // Check if it's a valid git repository
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      return {
        success: false,
        error: 'Selected directory is not a Git repository'
      }
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
      console.warn('Could not determine default branch:', e)
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
      return {
        success: false,
        error: 'Repository already exists'
      }
    }

    // Add new repository
    repositories.push(repository)

    // Save to config
    await fs.writeFile(CONFIG_PATH, JSON.stringify(repositories, null, 2), 'utf-8')

    return {
      success: true,
      repository
    }
  } catch (error) {
    console.error('Error creating repository:', error)
    return {
      success: false,
      error: error.message
    }
  }
})
```

---

### 3. `repository:switch` (Optional - if you need server-side logic)

Switches the active repository context.

**Request:**
```typescript
ipcMain.handle('repository:switch', async (event, repositoryId: string) => {
  // Implementation
})
```

**Note:** Currently switching is handled client-side in the frontend. You only need this if you want to persist the active repository or perform server-side operations when switching.

---

## Integration Steps

### Step 1: Create Repository Handlers File

Create `circuit/electron/repositoryHandlers.ts`:

```typescript
import { ipcMain, dialog, app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import simpleGit from 'simple-git'
import type { Repository } from '../src/types/workspace'

const CONFIG_PATH = path.join(app.getPath('userData'), 'repositories.json')

// Helper: Load repositories from config
async function loadRepositories(): Promise<{ success: boolean; repositories?: Repository[]; error?: string }> {
  try {
    const configExists = await fs.access(CONFIG_PATH).then(() => true).catch(() => false)

    if (!configExists) {
      return { success: true, repositories: [] }
    }

    const data = await fs.readFile(CONFIG_PATH, 'utf-8')
    const repositories: Repository[] = JSON.parse(data)
    return { success: true, repositories }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Helper: Save repositories to config
async function saveRepositories(repositories: Repository[]): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(repositories, null, 2), 'utf-8')
}

// Register all repository handlers
export function registerRepositoryHandlers() {
  // List repositories
  ipcMain.handle('repository:list', async () => {
    return await loadRepositories()
  })

  // Create repository
  ipcMain.handle('repository:create', async (event) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Repository Directory'
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'User canceled selection' }
      }

      const repoPath = result.filePaths[0]
      const git = simpleGit(repoPath)

      const isRepo = await git.checkIsRepo()
      if (!isRepo) {
        return { success: false, error: 'Selected directory is not a Git repository' }
      }

      const remotes = await git.getRemotes(true)
      const remoteUrl = remotes.length > 0 ? remotes[0].refs.fetch : null

      let defaultBranch = 'main'
      try {
        const branches = await git.branch()
        defaultBranch = branches.current || 'main'
      } catch (e) {
        console.warn('Could not determine default branch:', e)
      }

      const repository: Repository = {
        id: uuidv4(),
        name: path.basename(repoPath),
        path: repoPath,
        remoteUrl,
        defaultBranch,
        createdAt: new Date().toISOString()
      }

      const listResult = await loadRepositories()
      const repositories = listResult.repositories || []

      const duplicate = repositories.find(r => r.path === repoPath)
      if (duplicate) {
        return { success: false, error: 'Repository already exists' }
      }

      repositories.push(repository)
      await saveRepositories(repositories)

      return { success: true, repository }
    } catch (error) {
      console.error('Error creating repository:', error)
      return { success: false, error: error.message }
    }
  })
}
```

### Step 2: Register Handlers in Main Process

In your `circuit/electron/main.ts` or wherever you register IPC handlers:

```typescript
import { registerRepositoryHandlers } from './repositoryHandlers'

app.whenReady().then(() => {
  // ... existing code ...

  // Register repository handlers
  registerRepositoryHandlers()

  // ... rest of initialization ...
})
```

### Step 3: Install Dependencies (if needed)

```bash
npm install --save uuid
npm install --save-dev @types/uuid
```

---

## Testing

1. **Start the application**
2. **Click "Add Repository" in the Repository Switcher dropdown**
3. **Select a Git repository directory**
4. **Verify the repository appears in the list**
5. **Switch between repositories using the dropdown**
6. **Verify workspaces load for the selected repository**

---

## Frontend Code Changes Summary

The frontend has been updated with:

1. **Repository state management** in `AppSidebar.tsx`
   - `repositories` state
   - `currentRepository` state
   - Fallback to default repository

2. **Repository functions**
   - `loadRepositories()` - Calls `repository:list`
   - `createRepository()` - Calls `repository:create`
   - `switchRepository()` - Switches active repository and reloads workspaces

3. **RepositorySwitcher integration**
   - Connected `onSelectRepository` prop
   - Connected `onCreateRepository` prop
   - Passes full `repositories` array

---

## Error Handling

The frontend includes fallback behavior:
- If `repository:list` fails or returns no repositories, it falls back to a default repository based on the project path
- Errors are logged to console and shown to user via alerts
- Repository switching gracefully handles missing repositories

---

## Future Enhancements

Possible improvements:
1. **Persist active repository** across app restarts
2. **Repository settings** (default branch, ignore patterns)
3. **Repository removal** functionality
4. **Git remote status** checking
5. **Clone repository** from URL
6. **Recent repositories** list

---

## Troubleshooting

**"Repository already exists" error:**
- The selected directory path is already in the repositories list
- Check `repositories.json` in app data directory

**"Not a Git repository" error:**
- The selected directory is not initialized with Git
- Run `git init` in the directory first

**IPC handler not found:**
- Ensure `registerRepositoryHandlers()` is called in main process
- Check electron console for errors
- Verify handler names match exactly (`repository:list`, `repository:create`)

---

## Additional Resources

- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/api/ipc-main)
- [simple-git Documentation](https://github.com/steveukx/git-js)
- [Workspace Architecture](./WORKSPACE_ARCHITECTURE.md)
