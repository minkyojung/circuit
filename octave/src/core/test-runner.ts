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
