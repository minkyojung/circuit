# Code Signing and Notarization Setup Guide

## Current Status ✅

Your system is already configured with:
- **Developer ID Certificate**: Developer ID Application: Minkyo Jung (6DQK5MQC4H)
- **Team ID**: 6DQK5MQC4H
- **electron-builder.yml**: Updated with code signing configuration

## What's Left to Do

### Step 1: Create App-Specific Password

1. Visit: https://appleid.apple.com/account/manage
2. Sign in with your Apple ID (neuewelt5895@gmail.com or williamjung@bttrfly.me)
3. Go to **Security** section
4. Click **App-Specific Passwords**
5. Click **Generate Password**
6. Enter label: `Octave Notarization`
7. Copy the generated password (format: xxxx-xxxx-xxxx-xxxx)

### Step 2: Configure Environment Variables

1. Copy the template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your credentials:
   ```bash
   APPLE_ID=your-apple-id@example.com
   APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
   APPLE_TEAM_ID=6DQK5MQC4H
   ```

3. Load the environment variables:
   ```bash
   source .env
   export $(cat .env | xargs)
   ```

   Or add to your shell profile (~/.zshrc or ~/.bashrc):
   ```bash
   export APPLE_ID="your-apple-id@example.com"
   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
   export APPLE_TEAM_ID="6DQK5MQC4H"
   ```

### Step 3: Test Code Signing and Notarization

1. Build and package with signing:
   ```bash
   npm run build && npm run package
   ```

2. Verify the signature:
   ```bash
   codesign -vvv --deep --strict release/mac/Octave.app
   spctl -a -vv release/mac/Octave.app
   ```

3. Check notarization status (after packaging):
   ```bash
   xcrun stapler validate release/mac/Octave.app
   ```

## What electron-builder Does Automatically

When you run `npm run package` with the environment variables set:

1. **Code Signing**: Signs the app with your Developer ID certificate
2. **Notarization**: Submits the app to Apple for notarization
3. **Stapling**: Attaches the notarization ticket to the app
4. **DMG Creation**: Creates a signed and notarized DMG

## Troubleshooting

### Error: "No valid identity found"
- Make sure the certificate is installed in your Keychain
- Run: `security find-identity -v -p codesigning`

### Error: "Unable to notarize app"
- Check that APPLE_ID and APPLE_APP_SPECIFIC_PASSWORD are set
- Verify the Team ID matches your certificate

### Error: "App-specific password is incorrect"
- Regenerate the password at https://appleid.apple.com/account/manage
- Update the .env file with the new password

## Next Steps After Setup

1. Test the signed app on another Mac
2. Set up GitHub Actions for automated builds (see DISTRIBUTION_CONFIG_TEMPLATES.md)
3. Configure auto-updates (optional)

## References

- **electron-builder signing docs**: https://www.electron.build/code-signing
- **Apple notarization guide**: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- **Full distribution docs**: See DISTRIBUTION_DOCUMENTATION_INDEX.md

