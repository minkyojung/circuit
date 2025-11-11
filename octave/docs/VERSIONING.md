# Versioning and Release Process

## Version Numbering

Octave follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

### Current Version Format

- **Tag format**: `vX.Y.Z` (e.g., `v0.0.5`)
- **package.json**: `X.Y.Z` (e.g., `0.0.5`)

**Important**: The "v" prefix in Git tags is **required** for electron-updater to work correctly.

### Increment Rules

| Type | Increment | Example | When to Use |
|------|-----------|---------|-------------|
| MAJOR | `1.0.0` → `2.0.0` | Breaking changes, major rewrites | Rare |
| MINOR | `0.1.0` → `0.2.0` | New features, non-breaking changes | Common |
| PATCH | `0.0.1` → `0.0.2` | Bug fixes, patches | Very common |

## Release Process

### 1. Prepare Release

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Create release branch
git checkout -b release/v0.0.6

# 3. Update version in package.json
npm version patch  # or minor, or major

# 4. Update CHANGELOG.md
# Add release notes for this version

# 5. Commit changes
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: Bump version to 0.0.6"

# 6. Push and create PR
git push origin release/v0.0.6
gh pr create --title "Release v0.0.6" --body "Release notes..."
```

### 2. Build and Test

```bash
# Build production version
npm run build
npm run package:prod

# Test the built app
# - Install the DMG
# - Test core features
# - Verify version number in About dialog
```

### 3. Create GitHub Release

```bash
# 1. Merge release PR to main
gh pr merge --merge

# 2. Create and push tag
git checkout main
git pull origin main
git tag -a v0.0.6 -m "Release v0.0.6 - [Feature Name]"
git push origin v0.0.6

# 3. Create GitHub Release
gh release create v0.0.6 \
  --title "v0.0.6 - [Feature Name]" \
  --notes-file RELEASE_NOTES.md \
  release/Octave-0.0.6.dmg \
  release/Octave-0.0.6-mac.zip \
  release/Octave-0.0.6-arm64.dmg \
  release/Octave-0.0.6-arm64-mac.zip
```

### 4. Verify Auto-Update

```bash
# Check that latest release is correctly set
gh api repos/minkyojung/octave/releases/latest --jq '{tag_name, name, draft, prerelease}'

# Expected output:
# {
#   "tag_name": "v0.0.6",
#   "name": "v0.0.6 - Feature Name",
#   "draft": false,
#   "prerelease": false
# }
```

## Auto-Update Configuration

### electron-builder.production.yml

```yaml
publish:
  provider: github
  owner: minkyojung
  repo: octave
  releaseType: release  # Use 'release' (not 'draft' or 'prerelease')
```

### How Auto-Update Works

1. **App startup**: Checks for updates 5 seconds after launch
2. **Version comparison**: Compares package.json version with GitHub latest release
3. **Download**: If update available, shows banner with "Download Update" button
4. **Install**: Downloads update in background, prompts user to restart

### Update Check Logic

```
Current version (package.json): 0.0.5
Latest release (GitHub API):    v0.0.6

electron-updater:
  1. Strips "v" prefix from tag
  2. Compares: 0.0.5 < 0.0.6
  3. Result: Update available ✅
```

## Breaking Changes and Migration

When introducing breaking changes that affect user data or configuration:

### 1. Identify Breaking Changes

Examples:
- LocalStorage key renames
- Database schema changes
- Configuration file format changes
- API contract changes

### 2. Write Migration Code

```typescript
// Example: LocalStorage migration
function migrateFromV1toV2() {
  const oldKey = 'circuit-onboarding'
  const newKey = 'octave-onboarding'

  const oldData = localStorage.getItem(oldKey)
  if (oldData && !localStorage.getItem(newKey)) {
    localStorage.setItem(newKey, oldData)
    localStorage.removeItem(oldKey)
  }
}
```

### 3. Document Migration

In CHANGELOG.md:

```markdown
## [0.0.6] - 2025-01-15

### BREAKING CHANGES

- **LocalStorage**: Renamed keys from `circuit-*` to `octave-*`
  - **Migration**: Automatic migration runs on app startup
  - **Action Required**: None (automatic)

### Migration Guide

For users upgrading from v0.0.5 or earlier:
1. Your onboarding state will be automatically migrated
2. No action required
3. If issues occur, reset onboarding in Settings > Developer
```

### 4. Add Migration Tests

```typescript
describe('Migration from v0.0.5', () => {
  it('migrates circuit-onboarding to octave-onboarding', () => {
    localStorage.setItem('circuit-onboarding', '{"version":1,"completedAt":123}')

    migrateLocalStorageKeys()

    expect(localStorage.getItem('octave-onboarding')).toBe('{"version":1,"completedAt":123}')
    expect(localStorage.getItem('circuit-onboarding')).toBeNull()
  })
})
```

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| v0.0.5 | 2025-01-11 | Smart Commit, Auto-staging, Onboarding migration |
| v0.0.4 | 2025-01-10 | Initial Circuit release |

## Troubleshooting

### "No update available" when update exists

**Check:**
1. Verify GitHub release is not draft: `gh release view v0.0.6`
2. Verify tag format has "v" prefix: `git tag -l`
3. Check package.json version matches: `cat package.json | jq .version`
4. Check electron-builder.production.yml publish config

**Common mistake**: Tag is `0.0.6` instead of `v0.0.6`

**Fix:**
```bash
# Delete wrong tag
git tag -d 0.0.6
git push origin :refs/tags/0.0.6

# Create correct tag
git tag -a v0.0.6 -m "Release v0.0.6"
git push origin v0.0.6
```

### Update check fails silently

**Check logs:**
1. Open DevTools: `Cmd+Option+I`
2. Look for `[updater]` logs in Console

**Common causes:**
- Running in development mode (!app.isPackaged)
- Network error
- GitHub API rate limit

### Users report seeing onboarding after update

**Cause**: LocalStorage migration didn't run

**Fix**: Ensure `migrateLocalStorageKeys()` is called in `isOnboardingComplete()`

**Verify:**
```typescript
// In src/lib/onboarding.ts
export function isOnboardingComplete(): boolean {
  migrateLocalStorageKeys()  // ← Must be first line
  // ... rest of function
}
```
