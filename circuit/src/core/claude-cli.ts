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

export interface ParsedFix {
  rootCause: string
  fixedCode: string
  explanation: string
}

/**
 * Parse AI fix response to extract structured information
 *
 * Phase 6: Extract fixed code from AI response
 */
export function parseAiFix(aiResponse: string): ParsedFix | null {
  try {
    // Extract root cause (text between "## Root Cause" and next ##)
    const rootCauseRegex = /##\s*Root Cause\s*\n([\s\S]*?)(?=\n##|$)/i;
    const rootCauseMatch = aiResponse.match(rootCauseRegex);
    const rootCause = rootCauseMatch ? rootCauseMatch[1].trim() : 'See AI response';

    // Extract "## Fixed Code" section first
    const fixedCodeSectionRegex = /##\s*Fixed Code\s*\n([\s\S]*?)(?=\n##|$)/i;
    const fixedCodeSection = aiResponse.match(fixedCodeSectionRegex);

    if (!fixedCodeSection || !fixedCodeSection[1]) {
      console.warn('[Circuit] Could not find "## Fixed Code" section');
      return null;
    }

    // Extract code block from the Fixed Code section
    const codeBlockRegex = /```(?:javascript|js)?\s*\n([\s\S]*?)```/;
    const match = fixedCodeSection[1].match(codeBlockRegex);

    if (!match || !match[1]) {
      console.warn('[Circuit] Could not extract code block from Fixed Code section');
      return null;
    }

    const fixedCode = match[1].trim();

    // Validate that it looks like actual code (not just text)
    const looksLikeCode = fixedCode.includes('console.log') ||
                          fixedCode.includes('function') ||
                          fixedCode.includes('const') ||
                          fixedCode.includes('let') ||
                          fixedCode.includes('var') ||
                          fixedCode.includes(';');

    if (!looksLikeCode) {
      console.warn('[Circuit] Extracted content does not look like JavaScript code');
      return null;
    }

    // Extract explanation (text after "## Explanation")
    const explanationRegex = /##\s*Explanation\s*\n([\s\S]*?)$/i;
    const explanationMatch = aiResponse.match(explanationRegex);
    const explanation = explanationMatch ? explanationMatch[1].trim() : 'See AI response';

    return {
      rootCause,
      fixedCode,
      explanation
    };
  } catch (error) {
    console.error('[Circuit] Error parsing AI fix:', error);
    return null;
  }
}
