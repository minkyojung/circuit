# Onboarding System Documentation

## Overview

Octave uses a multi-step onboarding flow to ensure users have the necessary tools and configurations for optimal experience.

## Architecture

### Storage Keys

**Current (v0.0.5+):**
- `octave-onboarding` - Main onboarding completion state
- `octave-github-onboarding` - GitHub OAuth onboarding state

**Legacy (v0.0.4 and earlier):**
- `circuit-onboarding` - Old key name
- `circuit-github-onboarding` - Old key name

**Migration**: Automatic migration runs on app startup if legacy keys are detected.

### Onboarding Flow

```
┌─────────────────────────────────────────────┐
│ 1. GitHub OAuth Authentication              │
│ - Opens system browser                      │
│ - Redirects to localhost:3456               │
│ - Stores access token in electron-store    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 2. Environment Check                        │
│ - Git installation                          │
│ - Git config (user.name, user.email)       │
│ - GitHub CLI (optional)                     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 3. Repository Selection                     │
│ - Fetch user's GitHub repos                │
│ - Select repos to clone (min 1)            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 4. Repository Cloning                       │
│ - Clone selected repos to ~/octave         │
│ - Progress tracking                         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 5. Git Config Sync (Optional)               │
│ - Sync GitHub name/email to Git config     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 6. GitHub CLI Setup (Optional)              │
│ - Configure gh CLI with OAuth token        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 7. Complete                                 │
│ - Mark onboarding complete                 │
│ - Register repositories                    │
│ - Reload app                               │
└─────────────────────────────────────────────┘
```

## Files and Components

### Core Files

| File | Purpose |
|------|---------|
| `src/lib/onboarding.ts` | Utility functions for onboarding state management |
| `src/App.tsx` | Triggers onboarding dialog on app startup |
| `src/components/onboarding/UnifiedOnboardingDialog.tsx` | Main onboarding UI orchestrator |
| `electron/OnboardingService.ts` | Backend service for environment checks and repo cloning |
| `electron/githubAuth.ts` | GitHub OAuth flow implementation |

### Key Functions

**`isOnboardingComplete(): boolean`**
- Checks if user has completed onboarding
- **Automatically runs migration** from legacy keys
- Returns `true` if `completedAt > 0` or `skipped === true`

**`completeOnboarding(repository?: string): void`**
- Marks onboarding as complete
- Stores completion timestamp and optional repository

**`migrateLocalStorageKeys(): void`**
- Internal function that migrates `circuit-*` → `octave-*`
- Runs automatically on first `isOnboardingComplete()` call
- Safe to run multiple times (idempotent)

## OAuth Flow Details

### Authentication Process

1. **Initiate**: `startGitHubOAuth()` opens system browser
2. **User Authenticates**: User logs in to GitHub
3. **Callback**: GitHub redirects to `http://localhost:3456/auth/github/callback?code=xxx`
4. **Exchange**: App exchanges code for access token
5. **Store**: Token stored in `electron-store` (persistent)

### Error Handling

| Error | Cause | Message |
|-------|-------|---------|
| Timeout | User doesn't complete auth in 5 min | "GitHub authentication timed out" |
| access_denied | User clicks "Cancel" on GitHub | "Authentication cancelled by user" |
| Network error | No internet connection | "Failed to connect to GitHub" |
| Invalid code | Code already used or expired | "Authorization code is invalid" |

### Security

- OAuth tokens stored in `electron-store` (encrypted on macOS/Windows)
- Tokens never logged or exposed to renderer process
- HTTPS enforced for GitHub API calls
- Token scopes: `repo` (repository access), `user` (user info)

## LocalStorage Data Structure

### Main Onboarding State

```typescript
interface OnboardingStorage {
  version: number        // Schema version (currently 1)
  completedAt: number    // Unix timestamp
  repository?: string    // Optional: first repo cloned
  skipped: boolean       // True if user skipped onboarding
}
```

**Storage Key**: `octave-onboarding`

**Example**:
```json
{
  "version": 1,
  "completedAt": 1699564800000,
  "repository": "minkyojung/octave",
  "skipped": false
}
```

### GitHub Onboarding State

```typescript
interface GitHubOnboardingStorage {
  version: number
  completedAt: number
  clonedRepos: string[]  // Array of full repo names
  skipped: boolean
}
```

**Storage Key**: `octave-github-onboarding`

## Migration from v0.0.4

### Problem

In v0.0.4, the app was named "Circuit". LocalStorage keys used `circuit-` prefix:
- `circuit-onboarding`
- `circuit-github-onboarding`

In v0.0.5, we renamed to "Octave" and changed keys to:
- `octave-onboarding`
- `octave-github-onboarding`

Without migration, users upgrading from v0.0.4 would see onboarding again.

### Solution

Automatic migration in `src/lib/onboarding.ts`:

```typescript
function migrateLocalStorageKeys(): void {
  const legacyKey = localStorage.getItem('circuit-onboarding')
  const newKey = localStorage.getItem('octave-onboarding')

  if (legacyKey && !newKey) {
    localStorage.setItem('octave-onboarding', legacyKey)
    localStorage.removeItem('circuit-onboarding')
  }

  // Same for GitHub key
}
```

**When it runs**: Automatically on first `isOnboardingComplete()` call after upgrade.

**Idempotent**: Safe to run multiple times. Only migrates if:
- Legacy key exists
- New key doesn't exist

## Testing

### Reset Onboarding (Development)

1. Open DevTools (`Cmd+Option+I`)

2. Run in Console:
```javascript
localStorage.removeItem('octave-onboarding')
localStorage.removeItem('octave-github-onboarding')
location.reload()
```

Or use built-in dev tools:
```javascript
devTools.resetAllOnboarding()
devTools.resetAndReload()  // Auto-reload
```

### Test Migration

1. Set legacy key:
```javascript
localStorage.setItem('circuit-onboarding', JSON.stringify({
  version: 1,
  completedAt: Date.now(),
  skipped: false
}))
```

2. Reload app

3. Check migration:
```javascript
localStorage.getItem('octave-onboarding')  // Should exist
localStorage.getItem('circuit-onboarding')  // Should be null
```

## Common Issues

### Onboarding Shows Again After Update

**Cause**: LocalStorage keys changed from `circuit-*` to `octave-*`

**Fix**: Upgrade to v0.0.5+ (includes automatic migration)

### "Authentication cancelled by user" Error

**Possible causes**:
- User closed browser window before completing auth
- User clicked "Cancel" on GitHub authorization page
- OAuth timeout (5 minutes)

**Fix**: Click "Try Again" and complete the flow

### OAuth Timeout

**Cause**: User didn't complete authentication within 5 minutes

**Fix**: Restart onboarding and complete auth promptly

### "No repositories found"

**Cause**: GitHub account has no repositories

**Fix**: Create a repo on GitHub first, or skip onboarding

## Future Improvements

- [ ] Add "Skip Onboarding" button on first screen
- [ ] Support GitLab and Bitbucket OAuth
- [ ] Onboarding analytics (opt-in)
- [ ] Resume interrupted onboarding
- [ ] Export/import onboarding state
