/**
 * Smart Commit Analyzer
 *
 * Uses Claude to analyze git changes and propose atomic, well-structured commits.
 */

import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import type { SmartCommitPlan, CommitGroup, Warning, ChangedFile } from './types/smartCommit';

const CLAUDE_CLI_PATH = path.join(os.homedir(), '.claude/local/claude');

/**
 * Main analysis function
 *
 * Sends git diff to Claude and gets back a structured commit plan
 */
export async function analyzeChangesWithClaude(
  files: ChangedFile[],
  fullDiff: string
): Promise<SmartCommitPlan> {

  const prompt = buildAnalysisPrompt(files, fullDiff);

  return new Promise((resolve, reject) => {
    const claude = spawn(CLAUDE_CLI_PATH, [
      '--print',
      '--output-format', 'json',
      '--model', 'sonnet',          // Use Sonnet for better analysis
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000                // 60 second timeout
    });

    claude.stdin.write(JSON.stringify({
      role: 'user',
      content: prompt
    }));
    claude.stdin.end();

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      if (code === 0) {
        try {
          const response = parseClaudeResponse(stdout);
          const plan = validateAndEnrichPlan(response, files);
          resolve(plan);
        } catch (error) {
          reject(new Error(`Failed to parse Claude response: ${(error as Error).message}`));
        }
      } else {
        reject(new Error(`Claude CLI failed (exit ${code}): ${stderr}`));
      }
    });

    claude.on('error', (error) => {
      reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
    });
  });
}

/**
 * Build prompt for Claude
 */
function buildAnalysisPrompt(files: ChangedFile[], diff: string): string {
  const fileList = files.map(f => {
    const status = getStatusDescription(f.status);
    const size = f.additions || f.deletions ?
      ` (+${f.additions || 0}/-${f.deletions || 0})` : '';
    return `- ${status} ${f.path}${size}`;
  }).join('\n');

  return `You are a senior software engineer organizing Git commits.

**Task:** Analyze these changes and create a commit plan that follows best practices.

**Principles:**
1. **Atomic Commits**: Each commit should represent ONE logical change
2. **Conventional Commits**: Use types: feat, fix, refactor, docs, test, chore, style, perf
3. **Explain the "Why"**: Commit bodies should explain motivation, not just what changed
4. **Small & Focused**: Prefer 5-10 small commits over 1 large commit
5. **Build Order**: Ensure each commit builds successfully (dependencies first)

**Changed Files (${files.length} total):**
${fileList}

**Full Diff:**
\`\`\`diff
${diff.slice(0, 50000)}${diff.length > 50000 ? '\n... (diff truncated)' : ''}
\`\`\`

**Output Format (JSON):**
\`\`\`json
{
  "analysis": "Brief assessment of changes",
  "complexity": "simple|moderate|complex",
  "groups": [
    {
      "id": "unique-id",
      "type": "feat|fix|refactor|docs|test|chore|style|perf",
      "scope": "optional-scope",
      "title": "Short description (50 chars max)",
      "message": "Full conventional commit message with body explaining why",
      "files": ["relative/path/file.ts"],
      "reasoning": "Why these files belong together"
    }
  ],
  "warnings": [
    {
      "type": "large-commit|mixed-concerns|missing-tests|breaking-change",
      "message": "Description of the issue",
      "severity": "low|medium|high"
    }
  ]
}
\`\`\`

**Good Example:**
\`\`\`json
{
  "analysis": "Bug fix, new feature, and documentation update - well separated concerns",
  "complexity": "moderate",
  "groups": [
    {
      "id": "1",
      "type": "fix",
      "scope": "auth",
      "title": "Correct token expiry validation logic",
      "message": "fix(auth): Correct token expiry validation logic\\n\\nPrevious logic had an off-by-one error causing tokens to expire 1 hour early.\\nThis affected user sessions and caused unnecessary re-authentication.",
      "files": ["src/auth.ts"],
      "reasoning": "Independent bug fix - should be its own commit for easy cherry-picking"
    },
    {
      "id": "2",
      "type": "feat",
      "scope": "user",
      "title": "Add email validation to User model",
      "message": "feat(user): Add email validation to User model\\n\\nImplements RFC 5322 compliant email validation.\\nPrevents invalid emails from being stored in the database.",
      "files": ["src/models/User.ts"],
      "reasoning": "New feature - validation logic separate from API layer"
    }
  ],
  "warnings": []
}
\`\`\`

Now analyze the changes and provide your recommendation in JSON format:`;
}

/**
 * Get human-readable status description
 */
function getStatusDescription(status: string): string {
  switch (status) {
    case 'M': return '[Modified]';
    case 'A': return '[Added]';
    case 'D': return '[Deleted]';
    case 'R': return '[Renamed]';
    case 'MM': return '[Modified + Staged]';
    case '??': return '[Untracked]';
    default: return `[${status}]`;
  }
}

/**
 * Parse Claude's JSON response
 */
function parseClaudeResponse(responseText: string): any {
  console.log('[SmartCommitAnalyzer] Raw response text:', responseText.substring(0, 500));

  // Claude CLI wraps response in { content: [{ text: "..." }] }
  let parsed: any;

  try {
    parsed = JSON.parse(responseText);
    console.log('[SmartCommitAnalyzer] Parsed JSON:', JSON.stringify(parsed).substring(0, 500));
  } catch (e) {
    console.error('[SmartCommitAnalyzer] Failed to parse initial JSON:', e);
    throw new Error('Invalid JSON response from Claude');
  }

  // Extract text content
  // Claude CLI returns: { type: "result", result: "..." } or { content: [{ text: "..." }] }
  const content = parsed.result || parsed.content?.[0]?.text || parsed.text || responseText;
  console.log('[SmartCommitAnalyzer] Extracted content:', content.substring(0, 500));

  // Extract JSON from markdown code blocks if present
  const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/) ||
                    content.match(/```\s*\n([\s\S]*?)\n```/);

  const jsonStr = jsonMatch ? jsonMatch[1] : content;
  console.log('[SmartCommitAnalyzer] JSON string to parse:', jsonStr.substring(0, 500));

  const result = JSON.parse(jsonStr);
  console.log('[SmartCommitAnalyzer] Final parsed result:', JSON.stringify(result).substring(0, 500));
  return result;
}

/**
 * Validate and enrich the plan
 */
function validateAndEnrichPlan(
  rawPlan: any,
  files: ChangedFile[]
): SmartCommitPlan {

  // Validate structure
  if (!rawPlan.groups || !Array.isArray(rawPlan.groups)) {
    throw new Error('Invalid plan: missing groups array');
  }

  if (rawPlan.groups.length === 0) {
    throw new Error('Invalid plan: no commit groups');
  }

  // Validate each group
  const groups: CommitGroup[] = rawPlan.groups.map((g: any, idx: number) => {
    if (!g.files || g.files.length === 0) {
      throw new Error(`Group ${idx + 1} has no files`);
    }

    return {
      id: g.id || `group-${idx + 1}`,
      type: g.type || 'chore',
      scope: g.scope,
      title: g.title || 'Untitled change',
      message: g.message || g.title || 'Untitled change',
      files: g.files,
      reasoning: g.reasoning || 'No reasoning provided'
    };
  });

  // Validate warnings
  const warnings: Warning[] = (rawPlan.warnings || []).map((w: any) => ({
    type: w.type || 'mixed-concerns',
    message: w.message || 'Unknown warning',
    severity: w.severity || 'medium'
  }));

  // Auto-detect additional warnings
  const autoWarnings = detectWarnings(groups, files);
  warnings.push(...autoWarnings);

  // Calculate complexity
  const complexity = determineComplexity(groups, files);

  // Estimate time (rough: 2 seconds per commit)
  const estimatedTime = groups.length * 2;

  return {
    groups,
    totalFiles: groups.reduce((sum, g) => sum + g.files.length, 0),
    analysis: rawPlan.analysis || 'Changes analyzed successfully',
    complexity,
    warnings,
    estimatedTime
  };
}

/**
 * Auto-detect warnings
 */
function detectWarnings(
  groups: CommitGroup[],
  files: ChangedFile[]
): Warning[] {
  const warnings: Warning[] = [];

  // Check for large commits
  for (const group of groups) {
    if (group.files.length > 20) {
      warnings.push({
        type: 'large-commit',
        message: `Commit "${group.title}" has ${group.files.length} files (recommended: < 20)`,
        severity: 'medium'
      });
    }
  }

  // Check for too many commits
  if (groups.length > 15) {
    warnings.push({
      type: 'mixed-concerns',
      message: `Plan creates ${groups.length} commits (might be too granular)`,
      severity: 'low'
    });
  }

  // Check for missing tests
  const hasTestChanges = files.some(f =>
    f.path.includes('.test.') ||
    f.path.includes('.spec.') ||
    f.path.includes('__tests__')
  );

  const hasCodeChanges = files.some(f =>
    (f.path.endsWith('.ts') || f.path.endsWith('.tsx') ||
     f.path.endsWith('.js') || f.path.endsWith('.jsx')) &&
    !f.path.includes('.test.') && !f.path.includes('.spec.')
  );

  if (hasCodeChanges && !hasTestChanges) {
    warnings.push({
      type: 'missing-tests',
      message: 'Code changes detected but no test files modified',
      severity: 'low'
    });
  }

  return warnings;
}

/**
 * Determine overall complexity
 */
function determineComplexity(
  groups: CommitGroup[],
  files: ChangedFile[]
): 'simple' | 'moderate' | 'complex' {

  if (groups.length <= 3 && files.length <= 5) {
    return 'simple';
  }

  if (groups.length <= 8 && files.length <= 20) {
    return 'moderate';
  }

  return 'complex';
}
