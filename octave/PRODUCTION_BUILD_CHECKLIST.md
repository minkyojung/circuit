# Production Build Checklist

This checklist ensures that production builds are completed successfully without repeating common errors.

---

## Pre-Build Checklist

### 1. Environment Configuration

**Problem**: Missing environment variables cause build failures or runtime errors.

- [ ] **Verify `.env` file exists** in `octave/` directory
- [ ] **Check GitHub OAuth credentials** are configured:
  ```bash
  cat octave/.env | grep GITHUB_CLIENT_ID
  cat octave/.env | grep GITHUB_CLIENT_SECRET
  ```
  - `GITHUB_CLIENT_ID`: OAuth App Client ID from https://github.com/settings/developers
  - `GITHUB_CLIENT_SECRET`: OAuth App Client Secret (copy and save immediately after generation)

- [ ] **Check Apple notarization credentials** are configured:
  ```bash
  cat octave/.env | grep APPLE_ID
  cat octave/.env | grep APPLE_APP_SPECIFIC_PASSWORD
  cat octave/.env | grep APPLE_TEAM_ID
  ```
  - `APPLE_ID`: Your Apple ID email (e.g., williamjung@bttrfly.me)
  - `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password from https://appleid.apple.com
  - `APPLE_TEAM_ID`: Team ID from electron-builder.production.yml (6DQK5MQC4H)

**Reference**: See `.env.example` for all required variables.

---

### 2. TypeScript Files Verification

**Problem**: JavaScript files in `electron/` directory are ignored by TypeScript compiler, causing "Cannot find module" errors in packaged app.

- [ ] **Verify all Electron main process files use `.ts` extension**:
  ```bash
  ls -la octave/electron/*.js
  ```
  - If any `.js` files exist (except `main.cjs`), rename them to `.ts`
  - Example: `updater.js` → `updater.ts`

- [ ] **Check `tsconfig.electron.json` includes pattern**:
  ```json
  {
    "include": ["electron/**/*.ts"]
  }
  ```

**Why**: Only `.ts` files are compiled to `dist-electron/`. JavaScript files are skipped, causing module not found errors in production.

---

### 3. Code Signing Certificate

- [ ] **Verify Developer ID Application certificate is installed**:
  ```bash
  security find-identity -v -p codesigning | grep "Developer ID Application"
  ```
  - Expected: `Minkyo Jung (6DQK5MQC4H)`

- [ ] **Check certificate is not expired**

---

## Build Process

### 1. Clean Build

- [ ] **Remove previous build artifacts**:
  ```bash
  cd octave
  rm -rf dist dist-electron release
  ```

### 2. Install Dependencies

- [ ] **Install/update dependencies**:
  ```bash
  npm install
  ```

### 3. Build Frontend and Electron

- [ ] **Run build command**:
  ```bash
  npm run build
  ```

- [ ] **Verify build outputs**:
  - [ ] `dist/` directory exists with Vite build
  - [ ] `dist-electron/` directory exists with compiled TypeScript
  - [ ] **Critical**: Check `dist-electron/updater.js` exists (5.7KB):
    ```bash
    ls -lh dist-electron/updater.js
    ```

### 4. Package and Sign

- [ ] **Run production packaging**:
  ```bash
  npm run package:prod
  ```

- [ ] **Monitor for notarization warnings**:
  - If you see `"skipped macOS notarization"`, the build will succeed but DMG files won't be notarized
  - This requires manual notarization (see Post-Build section)

---

## Post-Build Verification

### 1. Check Build Output

- [ ] **Verify DMG files exist**:
  ```bash
  ls -lh release/*.dmg
  ```
  - Expected files:
    - `Octave-{version}.dmg` (x64, ~206MB)
    - `Octave-{version}-arm64.dmg` (ARM64, ~199MB)

### 2. Verify Notarization Status

- [ ] **Check if DMG files are notarized**:
  ```bash
  spctl -a -vv -t install release/Octave-*.dmg
  ```
  - **Success**: Should show `source=Notarized Developer ID`
  - **Failure**: Shows `source=Developer ID` (signed but not notarized)

### 3. Manual Notarization (if needed)

If electron-builder skipped notarization:

- [ ] **Notarize x64 DMG**:
  ```bash
  xcrun notarytool submit release/Octave-{version}.dmg \
    --apple-id="${APPLE_ID}" \
    --password="${APPLE_APP_SPECIFIC_PASSWORD}" \
    --team-id="${APPLE_TEAM_ID}" \
    --wait
  ```

- [ ] **Notarize arm64 DMG**:
  ```bash
  xcrun notarytool submit release/Octave-{version}-arm64.dmg \
    --apple-id="${APPLE_ID}" \
    --password="${APPLE_APP_SPECIFIC_PASSWORD}" \
    --team-id="${APPLE_TEAM_ID}" \
    --wait
  ```

- [ ] **Staple notarization tickets**:
  ```bash
  xcrun stapler staple release/Octave-{version}.dmg
  xcrun stapler staple release/Octave-{version}-arm64.dmg
  ```

- [ ] **Verify stapling succeeded**:
  ```bash
  xcrun stapler validate release/Octave-*.dmg
  ```

---

## GitHub Release Update

### 1. Delete Old Assets

- [ ] **Remove old DMG files from release**:
  ```bash
  gh release delete-asset v{version} Octave-{version}.dmg --yes
  gh release delete-asset v{version} Octave-{version}-arm64.dmg --yes
  ```

### 2. Upload New Assets

- [ ] **Upload notarized DMG files**:
  ```bash
  gh release upload v{version} \
    release/Octave-{version}.dmg \
    release/Octave-{version}-arm64.dmg
  ```

### 3. Verify Release

- [ ] **Check release page**: https://github.com/minkyojung/octave/releases/tag/v{version}
- [ ] **Verify both DMG files are listed**
- [ ] **Test download and installation**:
  - Download DMG
  - Open DMG (should not show Gatekeeper warning)
  - Drag to Applications
  - Open app (should not show "unidentified developer" warning)

---

## Common Errors and Solutions

### Error: "Cannot find module './updater.js'"

**Cause**: `updater.js` file was not compiled because it had `.js` extension instead of `.ts`.

**Solution**:
1. Rename `electron/updater.js` to `electron/updater.ts`
2. Run `npm run build:electron`
3. Verify `dist-electron/updater.js` exists (5.7KB)
4. Rebuild: `npm run package:prod`

**Prevention**: Always use `.ts` extension for Electron main process files.

---

### Error: "GITHUB_CLIENT_ID not configured in .env"

**Cause**: Missing GitHub OAuth credentials in `.env` file.

**Solution**:
1. Create OAuth App at https://github.com/settings/developers
   - Application name: `Octave`
   - Homepage URL: `https://github.com/minkyojung/octave`
   - Authorization callback URL: `http://localhost:3456/auth/github/callback`
2. Copy Client ID and Client Secret to `.env`:
   ```bash
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   ```
3. Rebuild: `npm run build && npm run package:prod`

**Prevention**: Always verify `.env` file exists with all required credentials before building.

---

### Warning: "skipped macOS notarization"

**Cause**: electron-builder couldn't generate notarize options (environment variables not read properly).

**Solution**: Manually notarize DMG files (see "Manual Notarization" section above).

**Prevention**:
- Verify `.env` file is in correct location (`octave/.env`)
- Check environment variables are loaded: `cat .env`
- Consider using `dotenv-cli` to ensure variables are loaded:
  ```bash
  npx dotenv-cli -e .env -- npm run package:prod
  ```

---

## Version Update Process

When releasing a new version:

1. [ ] Update version in `package.json`: `"version": "0.0.X"`
2. [ ] Create git tag: `git tag -a v0.0.X -m "Release v0.0.X"`
3. [ ] Push tag: `git push origin v0.0.X`
4. [ ] Follow this checklist for building
5. [ ] Create GitHub Release for the tag
6. [ ] Upload DMG files to release

---

## Historical Issues Log

### v0.0.2 Build (2025-11-10)

**Issues Encountered**:
1. ❌ `updater.js` not found in packaged app
   - **Cause**: File had `.js` extension, not compiled by TypeScript
   - **Fix**: Renamed to `updater.ts`, rebuilt
   - **Time Lost**: ~30 minutes

2. ❌ GitHub OAuth error on app startup
   - **Cause**: `.env` file missing `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
   - **Fix**: Created OAuth App, added credentials to `.env`
   - **Time Lost**: ~15 minutes

3. ⚠️ Notarization skipped by electron-builder
   - **Cause**: Environment variables not read by electron-builder
   - **Fix**: Manual notarization with `xcrun notarytool`
   - **Time Lost**: ~10 minutes

**Lessons Learned**:
- Always use `.ts` extension for Electron TypeScript files
- Verify `.env` file before building
- Keep `.env.example` up to date as template
- Manual notarization is a reliable fallback

---

## Contacts and Resources

- **Apple Developer**: https://developer.apple.com/account
- **Apple ID App-Specific Passwords**: https://appleid.apple.com
- **GitHub OAuth Apps**: https://github.com/settings/developers
- **electron-builder Docs**: https://www.electron.build
- **Code Signing Guide**: https://www.electron.build/code-signing

---

## Maintenance

This checklist should be updated whenever:
- New build errors are encountered
- Build process changes
- New environment variables are added
- Tool versions are upgraded

**Last Updated**: 2025-11-10
**Last Build**: v0.0.2
