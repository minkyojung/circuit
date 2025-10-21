/**
 * Phase 5: Claude CLI Integration (Conductor-style)
 *
 * Uses the user's Claude Code CLI installation to generate fixes.
 * No API key management needed - Claude Code handles authentication.
 */

export interface ClaudeCliRequest {
  testError: string
  testCode?: string
  sourceCode?: string
  projectType: string
}

export interface ClaudeCliResponse {
  success: boolean
  fix?: string
  error?: string
  cost_usd?: number
  session_id?: string
}

/**
 * Generate a prompt for Claude CLI
 */
export function generateFixPrompt(request: ClaudeCliRequest): string {
  const { testError, testCode, sourceCode, projectType } = request

  return `You are helping fix a failing test in a ${projectType} project.

**Test Error:**
\`\`\`
${testError}
\`\`\`

${testCode ? `**Test Code:**
\`\`\`javascript
${testCode}
\`\`\`
` : ''}

${sourceCode ? `**Source Code:**
\`\`\`javascript
${sourceCode}
\`\`\`
` : ''}

Please analyze the error and suggest a fix. Provide:

1. **Root Cause**: What's causing the test to fail?
2. **Fix**: The exact code changes needed
3. **Explanation**: Why this fix works

Be concise and actionable.`
}
