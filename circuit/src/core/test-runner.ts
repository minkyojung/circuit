/**
 * Phase 4: Test Execution
 *
 * npm test 실행하고 결과 파싱
 */

export interface TestResult {
  success: boolean
  passed: number
  failed: number
  total: number
  duration: number  // ms
  output: string    // Full stdout
  errors: string[]  // Error messages
}

/**
 * Test output 파싱 (Jest/Vitest 형식)
 */
export function parseTestOutput(stdout: string, stderr: string): TestResult {
  const output = stdout + '\n' + stderr

  // Default result
  const result: TestResult = {
    success: false,
    passed: 0,
    failed: 0,
    total: 0,
    duration: 0,
    output,
    errors: []
  }

  // Jest/Vitest: "Tests: 1 failed, 2 passed, 3 total"
  const testSummaryMatch = output.match(/Tests?:\s+(?:(\d+)\s+failed?,?\s*)?(?:(\d+)\s+passed?,?\s*)?(\d+)\s+total/i)
  if (testSummaryMatch) {
    result.failed = parseInt(testSummaryMatch[1] || '0')
    result.passed = parseInt(testSummaryMatch[2] || '0')
    result.total = parseInt(testSummaryMatch[3] || '0')
    result.success = result.failed === 0
  }

  // Duration: "Time: 1.234s"
  const durationMatch = output.match(/Time:\s+([\d.]+)\s*s/i)
  if (durationMatch) {
    result.duration = parseFloat(durationMatch[1]) * 1000
  }

  // Extract error messages
  const errorLines = output.split('\n').filter(line =>
    line.includes('FAIL') ||
    line.includes('Error:') ||
    line.includes('Expected') ||
    line.includes('Received')
  )
  result.errors = errorLines.slice(0, 10) // Keep first 10 errors

  return result
}

/**
 * Format test result for display
 */
export function formatTestResult(result: TestResult): string {
  const status = result.success ? '✅ PASS' : '❌ FAIL'
  const summary = `${status} | ${result.passed}/${result.total} tests passed`
  const duration = result.duration > 0 ? ` | ${(result.duration / 1000).toFixed(2)}s` : ''

  return `${summary}${duration}`
}

/**
 * Get test command based on project type
 */
export function getTestCommand(_projectType: string): string {
  // For now, just use npm test
  // Later can customize based on projectType (react, nextjs, etc)
  return 'npm test'
}
