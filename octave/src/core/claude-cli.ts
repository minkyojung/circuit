/**
 * Phase 5-6: Claude CLI Integration (Conductor-style)
 *
 * Uses the user's Claude Code CLI installation to generate fixes.
 * No API key management needed - Claude Code handles authentication.
 */

export interface ClaudeCliRequest {
  testError: string
  testCode?: string
  sourceCode?: string
  projectType: string
  testFilePath?: string
}

export interface ClaudeCliResponse {
  success: boolean
  fix?: string
  error?: string
  cost_usd?: number
  session_id?: string
  fixedCode?: string  // Phase 6: Extracted code from AI response
}
