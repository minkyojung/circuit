# Octave Release & Auto-Update Guide

> **The Definitive Guide to Publishing Octave Releases**
>
> This document ensures every release is production-ready, notarized, and auto-updatable.

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Release Checklist](#pre-release-checklist)
3. [Release Process (Step-by-Step)](#release-process-step-by-step)
4. [Verification & Testing](#verification--testing)
5. [Troubleshooting](#troubleshooting)
6. [Architecture Notes](#architecture-notes)

---

## Overview

### What This Guide Does

- Publishes a new version of Octave to GitHub Releases
- Ensures all files are properly notarized for macOS
- Enables auto-update for existing users
- Maintains semantic versioning

### Key Requirements

- **Apple Developer Account** with notarization credentials
- **GitHub Repository** with push access
- **Code Signing Certificate** installed (Developer ID Application)
- **Environment Variables** configured in `.env`:
  ```bash
  APPLE_ID=williamjung@bttrfly.me
  APPLE_APP_SPECIFIC_PASSWORD=fuoo-jcrw-wpds-csro
  APPLE_TEAM_ID=6DQK5MQC4H
  ```

---

## Pre-Release Checklist

Before starting the release process, verify:

- [ ] All changes are committed and pushed to git
- [ ] Tests pass (`npm test`)
- [ ] App runs correctly in development (`npm run dev`)
- [ ] `.env` file contains Apple credentials
- [ ] Code signing certificate is valid (check Keychain Access)
- [ ] You have decided on the new version number (e.g., `0.0.5`)

---

## Release Process (Step-by-Step)

### Step 1: Bump Version Number

```bash
# Edit package.json and update version
# From: "version": "0.0.4"
# To:   "version": "0.0.5"
```

**Critical:** electron-updater compares version numbers. Ensure you follow semantic versioning:
- Patch: `0.0.4` → `0.0.5` (bug fixes)
- Minor: `0.0.5` → `0.1.0` (new features)
- Major: `0.1.0` → `1.0.0` (breaking changes)

---

### Step 2: Build the Application

```bash
cd octave
npm run build
```

**Expected output:** Vite build completes successfully, followed by TypeScript compilation.

**Time estimate:** ~10-15 seconds

---

### Step 3: Package for Production

```bash
npm run package:prod
```

**Expected output:**
- `release/Octave-X.X.X.dmg` (x64)
- `release/Octave-X.X.X-arm64.dmg` (arm64)
- `release/Octave-X.X.X-mac.zip` (x64) ← **Required for auto-update**
- `release/Octave-X.X.X-arm64-mac.zip` (arm64) ← **Required for auto-update**
- `release/latest-mac.yml` ← **Critical metadata file**

**Time estimate:** ~2-3 minutes

**⚠️ Common Issue:** If ZIP files are missing, verify `electron-builder.production.yml` includes:
```yaml
target:
  - target: dmg
    arch:
      - x64
      - arm64
  - target: zip  # Must be present!
    arch:
      - x64
      - arm64
```

---

### Step 4: Notarize All Files

Notarization is **required** for macOS Gatekeeper. Users cannot open non-notarized apps.

#### 4.1 Notarize x64 DMG

```bash
xcrun notarytool submit release/Octave-X.X.X.dmg \
  --apple-id="williamjung@bttrfly.me" \
  --password="fuoo-jcrw-wpds-csro" \
  --team-id="6DQK5MQC4H" \
  --wait
```

**Time estimate:** ~2-5 minutes (Apple's servers process the file)

**Expected output:** `status: Accepted`

**If rejected:** Run `xcrun notarytool log <submission-id>` to see why

#### 4.2 Staple Notarization to x64 DMG

```bash
xcrun stapler staple release/Octave-X.X.X.dmg
```

**Expected output:** `The staple and validate action worked!`

#### 4.3 Notarize arm64 DMG

```bash
xcrun notarytool submit release/Octave-X.X.X-arm64.dmg \
  --apple-id="williamjung@bttrfly.me" \
  --password="fuoo-jcrw-wpds-csro" \
  --team-id="6DQK5MQC4H" \
  --wait
```

#### 4.4 Staple Notarization to arm64 DMG

```bash
xcrun stapler staple release/Octave-X.X.X-arm64.dmg
```

#### 4.5 Notarize x64 ZIP

```bash
xcrun notarytool submit release/Octave-X.X.X-mac.zip \
  --apple-id="williamjung@bttrfly.me" \
  --password="fuoo-jcrw-wpds-csro" \
  --team-id="6DQK5MQC4H" \
  --wait
```

**Note:** ZIP files cannot be stapled (they don't support stapling)

#### 4.6 Notarize arm64 ZIP

```bash
xcrun notarytool submit release/Octave-X.X.X-arm64-mac.zip \
  --apple-id="williamjung@bttrfly.me" \
  --password="fuoo-jcrw-wpds-csro" \
  --team-id="6DQK5MQC4H" \
  --wait
```

**Total time estimate:** ~10-15 minutes for all 4 notarizations

---

### Step 5: Create Git Tag

```bash
git tag vX.X.X
git push origin vX.X.X
```

**Why this matters:** GitHub Releases are tied to git tags.

---

### Step 6: Create GitHub Release

```bash
gh release create vX.X.X \
  --title "vX.X.X" \
  --notes "Release notes here..." \
  release/Octave-X.X.X.dmg \
  release/Octave-X.X.X-arm64.dmg \
  release/Octave-X.X.X-mac.zip \
  release/Octave-X.X.X-arm64-mac.zip \
  release/latest-mac.yml
```

**Critical Files to Upload:**
1. Both DMG files (for manual installation)
2. Both ZIP files (for auto-update)
3. `latest-mac.yml` (metadata file for electron-updater)

**Time estimate:** ~1-2 minutes (upload time depends on internet speed)

---

### Step 7: Mark as Latest Release

```bash
gh release edit vX.X.X --latest
```

**Why this is critical:**
- electron-updater queries GitHub's `/repos/:owner/:repo/releases/latest` API
- If the wrong release is marked "latest", auto-update will fail
- GitHub sometimes auto-marks releases based on creation time, not version number

**Verification:**
```bash
curl -s https://api.github.com/repos/minkyojung/octave/releases/latest | jq -r '.tag_name'
```

**Expected output:** `vX.X.X` (your new version)

---

## Verification & Testing

### Verify GitHub Release

```bash
gh release view vX.X.X --json assets --jq '.assets[].name'
```

**Expected output (5 files):**
```
latest-mac.yml
Octave-X.X.X-arm64.dmg
Octave-X.X.X-arm64-mac.zip
Octave-X.X.X.dmg
Octave-X.X.X-mac.zip
```

### Test Auto-Update Locally

1. Install the **previous version** of Octave
2. Quit Octave completely (Cmd+Q)
3. Open Octave from Applications folder
4. Wait 5 seconds (auto-check runs on startup)
5. Update banner should appear at top of window
6. Click "Download Update"
7. Download should succeed (no "ZIP file not provided" error)
8. After download, quit and reopen Octave
9. Verify version updated to X.X.X (check "About" or `defaults read /Applications/Octave.app/Contents/Info.plist CFBundleShortVersionString`)

### Monitor Auto-Update in Terminal

To see main process logs (including updater logs):

```bash
/Applications/Octave.app/Contents/MacOS/Octave
```

**Expected logs:**
```
[main.cjs] Initializing auto-updater...
[updater] Initializing auto-updater...
[updater] Running automatic update check...
Checking for update
[updater] Checking for updates...
[updater] Update available: X.X.X
```

---

## Troubleshooting

### Problem: "ZIP file not provided" Error

**Cause:** ZIP files are missing from the release.

**Solution:**
1. Verify `electron-builder.production.yml` includes ZIP target (see Step 3)
2. Rebuild with `npm run package:prod`
3. Upload ZIP files to GitHub Release
4. Update `latest-mac.yml` to include ZIP file metadata

---

### Problem: "Cannot find latest-mac.yml in the latest release"

**Cause 1:** `latest-mac.yml` not uploaded to GitHub Release

**Solution:**
```bash
gh release upload vX.X.X release/latest-mac.yml --clobber
```

**Cause 2:** Wrong release is marked as "latest"

**Solution:**
```bash
gh release edit vX.X.X --latest
```

**Verification:**
```bash
curl -s https://api.github.com/repos/minkyojung/octave/releases/latest | jq -r '.tag_name'
```

---

### Problem: "Update for version X.X.X is not available (latest version: X.X.X)"

**Cause:** The installed version is the same as or newer than the latest release.

**Solution:** This is not an error. electron-updater correctly detected no update is needed.

**To test auto-update:** Install an older version first.

---

### Problem: Notarization Rejected

**Diagnosis:**
```bash
xcrun notarytool log <submission-id> --apple-id="williamjung@bttrfly.me" --password="fuoo-jcrw-wpds-csro" --team-id="6DQK5MQC4H"
```

**Common causes:**
- Missing entitlements
- Invalid code signature
- Unsigned native modules (better-sqlite3, node-pty)

**Solution:** Check `build/entitlements.mac.plist` and ensure native modules are properly signed.

---

### Problem: GitHub API Returns Wrong "Latest" Release

**Cause:** GitHub's `/releases/latest` endpoint prioritizes **creation time**, not semantic versioning.

**Example:**
- v0.0.4 created at 12:48:50
- v0.0.3 created at 13:28:41 (later)
- GitHub API returns v0.0.3 as "latest" ❌

**Solution 1 (Recommended):** Explicitly mark correct release as latest
```bash
gh release edit v0.0.4 --latest
```

**Solution 2:** Mark older release as pre-release
```bash
gh release edit v0.0.3 --prerelease
```

---

## Architecture Notes

### How Auto-Update Works

1. **App Launch (5 seconds after ready):**
   - `electron/updater.ts` calls `autoUpdater.checkForUpdates()`

2. **Update Check:**
   - electron-updater requests: `GET /repos/minkyojung/octave/releases/latest`
   - Downloads `latest-mac.yml` from the release
   - Parses version number and file metadata

3. **Version Comparison:**
   - Compares installed version vs. `latest-mac.yml` version
   - Uses semantic versioning rules
   - Downgrades are blocked by default

4. **If Update Available:**
   - Sends IPC event: `'updater:status'` with `event: 'update-available'`
   - Renderer shows update banner
   - User clicks "Download Update"

5. **Download:**
   - Downloads ZIP file (not DMG) from GitHub Release
   - Validates SHA-512 checksum
   - Stores in system temp directory

6. **Installation:**
   - User quits app
   - electron-updater extracts ZIP
   - Replaces `/Applications/Octave.app`
   - Next launch runs updated version

### Why ZIP Files Are Required

- **DMG files:** Used for initial installation (manual download)
- **ZIP files:** Used for auto-update (programmatic extraction)

electron-updater **cannot extract DMG files** programmatically. It requires ZIP files.

### File Structure in GitHub Release

```
v0.0.5/
├── latest-mac.yml              ← Metadata (version, checksums, file list)
├── Octave-0.0.5.dmg            ← Manual install (x64)
├── Octave-0.0.5-arm64.dmg      ← Manual install (arm64)
├── Octave-0.0.5-mac.zip        ← Auto-update (x64) ⚠️ REQUIRED
└── Octave-0.0.5-arm64-mac.zip  ← Auto-update (arm64) ⚠️ REQUIRED
```

### latest-mac.yml Format

```yaml
version: 0.0.5
files:
  - url: Octave-0.0.5-mac.zip
    sha512: <checksum>
    size: <bytes>
  - url: Octave-0.0.5-arm64-mac.zip
    sha512: <checksum>
    size: <bytes>
path: Octave-0.0.5-mac.zip
sha512: <checksum>
releaseDate: '2025-11-10T13:51:09.275Z'
```

electron-builder automatically generates this file during `npm run package:prod`.

---

## Quick Reference: Complete Release Workflow

```bash
# 1. Bump version in package.json
# Edit: "version": "0.0.5"

# 2. Build and package
cd octave
npm run build
npm run package:prod

# 3. Notarize all files (parallel execution recommended)
xcrun notarytool submit release/Octave-0.0.5.dmg --apple-id="williamjung@bttrfly.me" --password="fuoo-jcrw-wpds-csro" --team-id="6DQK5MQC4H" --wait
xcrun stapler staple release/Octave-0.0.5.dmg

xcrun notarytool submit release/Octave-0.0.5-arm64.dmg --apple-id="williamjung@bttrfly.me" --password="fuoo-jcrw-wpds-csro" --team-id="6DQK5MQC4H" --wait
xcrun stapler staple release/Octave-0.0.5-arm64.dmg

xcrun notarytool submit release/Octave-0.0.5-mac.zip --apple-id="williamjung@bttrfly.me" --password="fuoo-jcrw-wpds-csro" --team-id="6DQK5MQC4H" --wait

xcrun notarytool submit release/Octave-0.0.5-arm64-mac.zip --apple-id="williamjung@bttrfly.me" --password="fuoo-jcrw-wpds-csro" --team-id="6DQK5MQC4H" --wait

# 4. Create git tag
git tag v0.0.5
git push origin v0.0.5

# 5. Create GitHub Release
gh release create v0.0.5 \
  --title "v0.0.5" \
  --notes "Release notes..." \
  release/Octave-0.0.5.dmg \
  release/Octave-0.0.5-arm64.dmg \
  release/Octave-0.0.5-mac.zip \
  release/Octave-0.0.5-arm64-mac.zip \
  release/latest-mac.yml

# 6. Mark as latest
gh release edit v0.0.5 --latest

# 7. Verify
gh release view v0.0.5 --json assets --jq '.assets[].name'
curl -s https://api.github.com/repos/minkyojung/octave/releases/latest | jq -r '.tag_name'
```

---

## Summary: Critical Success Factors

✅ **Always include ZIP files** (electron-updater cannot use DMG)
✅ **Upload latest-mac.yml** (metadata file is mandatory)
✅ **Mark release as "latest"** (GitHub API must return correct version)
✅ **Notarize all files** (macOS Gatekeeper blocks non-notarized apps)
✅ **Follow semantic versioning** (electron-updater compares versions)
✅ **Test on previous version** (install old version, verify update works)

---

**Last Updated:** 2025-11-10
**Maintainer:** William Jung
**Octave Version:** 0.0.4+
