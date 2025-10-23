/**
 * Privacy Filter for MCP Call History
 *
 * Automatically masks sensitive data (file paths, credentials, env vars)
 * before storing in history database.
 */

export interface PrivacyConfig {
  maskFilePaths: boolean
  maskEnvVars: boolean
  maskCredentials: boolean
  maxParamSize: number // bytes
  retention: {
    days: number
    maxCalls: number
  }
}

export const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  maskFilePaths: true,
  maskEnvVars: true,
  maskCredentials: true,
  maxParamSize: 100 * 1024, // 100KB
  retention: {
    days: 7,
    maxCalls: 10000,
  },
}

export class PrivacyFilter {
  private config: PrivacyConfig

  // Sensitive key patterns
  private readonly sensitiveKeys = [
    'password',
    'passwd',
    'pwd',
    'apikey',
    'api_key',
    'apiKey',
    'token',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'secret',
    'secretKey',
    'secret_key',
    'privateKey',
    'private_key',
    'authorization',
    'auth',
    'credential',
    'credentials',
  ]

  // File path patterns (Unix and Windows)
  private readonly filePathPatterns = [
    /\/Users\/[^\/\s]+/g, // macOS: /Users/username
    /\/home\/[^\/\s]+/g, // Linux: /home/username
    /C:\\Users\\[^\\\/\s]+/gi, // Windows: C:\Users\username
  ]

  constructor(config: PrivacyConfig = DEFAULT_PRIVACY_CONFIG) {
    this.config = config
  }

  /**
   * Sanitize call data before storage
   */
  sanitizeCall(call: any): any {
    const sanitized = { ...call }

    // 1. Mask file paths
    if (this.config.maskFilePaths) {
      if (typeof sanitized.requestParams === 'string') {
        sanitized.requestParams = this.maskPaths(sanitized.requestParams)
      }
      if (typeof sanitized.responseResult === 'string') {
        sanitized.responseResult = this.maskPaths(sanitized.responseResult)
      }
    }

    // 2. Mask credentials
    if (this.config.maskCredentials) {
      if (typeof sanitized.requestParams === 'string') {
        try {
          const parsed = JSON.parse(sanitized.requestParams)
          const masked = this.maskSensitiveKeys(parsed)
          sanitized.requestParams = JSON.stringify(masked)
        } catch (error) {
          // Not JSON, apply string masking
          sanitized.requestParams = this.maskSensitiveInString(sanitized.requestParams)
        }
      }
    }

    // 3. Mask environment variables
    if (this.config.maskEnvVars) {
      if (typeof sanitized.requestParams === 'string') {
        sanitized.requestParams = this.maskEnvVars(sanitized.requestParams)
      }
    }

    // 4. Truncate large data
    if (this.config.maxParamSize > 0) {
      if (typeof sanitized.requestParams === 'string' &&
          sanitized.requestParams.length > this.config.maxParamSize) {
        sanitized.requestParams = JSON.stringify({
          _truncated: true,
          _originalSize: sanitized.requestParams.length,
          _preview: sanitized.requestParams.slice(0, 1000),
        })
        sanitized.truncated = true
      }

      if (typeof sanitized.responseResult === 'string' &&
          sanitized.responseResult.length > this.config.maxParamSize) {
        sanitized.responseResult = JSON.stringify({
          _truncated: true,
          _originalSize: sanitized.responseResult.length,
          _preview: sanitized.responseResult.slice(0, 1000),
        })
        sanitized.truncated = true
      }
    }

    return sanitized
  }

  /**
   * Mask file paths in a string
   * /Users/john/secret.txt → /Users/***/secret.txt
   */
  private maskPaths(str: string): string {
    let masked = str

    for (const pattern of this.filePathPatterns) {
      masked = masked.replace(pattern, (match) => {
        // Extract the base path and replace username
        if (match.includes('/Users/')) {
          return match.replace(/\/Users\/[^\/\s]+/, '/Users/***')
        } else if (match.includes('/home/')) {
          return match.replace(/\/home\/[^\/\s]+/, '/home/***')
        } else if (match.includes('C:\\Users\\')) {
          return match.replace(/C:\\Users\\[^\\\/\s]+/i, 'C:\\Users\\***')
        }
        return match
      })
    }

    return masked
  }

  /**
   * Mask sensitive keys in an object (recursive)
   */
  private maskSensitiveKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskSensitiveKeys(item))
    }

    const masked: any = {}

    for (const [key, value] of Object.entries(obj)) {
      // Check if key is sensitive
      const keyLower = key.toLowerCase()
      const isSensitive = this.sensitiveKeys.some(pattern =>
        keyLower.includes(pattern.toLowerCase())
      )

      if (isSensitive && typeof value === 'string') {
        // Mask the value
        masked[key] = '***'
      } else if (typeof value === 'object' && value !== null) {
        // Recursively mask nested objects
        masked[key] = this.maskSensitiveKeys(value)
      } else {
        masked[key] = value
      }
    }

    return masked
  }

  /**
   * Mask sensitive patterns in a string (for non-JSON)
   */
  private maskSensitiveInString(str: string): string {
    let masked = str

    // Mask patterns like "password=abc123"
    for (const key of this.sensitiveKeys) {
      const patterns = [
        new RegExp(`${key}\\s*[=:]\\s*["']?([^"'\\s,}]+)`, 'gi'),
        new RegExp(`["']${key}["']\\s*[=:]\\s*["']?([^"'\\s,}]+)`, 'gi'),
      ]

      for (const pattern of patterns) {
        masked = masked.replace(pattern, (match, value) => {
          return match.replace(value, '***')
        })
      }
    }

    return masked
  }

  /**
   * Mask environment variables
   * Patterns: API_KEY=abc123, export SECRET=xyz
   */
  private maskEnvVars(str: string): string {
    let masked = str

    // Pattern: VARIABLE_NAME=value
    masked = masked.replace(
      /\b([A-Z_]+)\s*=\s*["']?([^"'\s,}]+)/g,
      (match, varName, value) => {
        // Check if variable name suggests it's sensitive
        const nameLower = varName.toLowerCase()
        const isSensitive = this.sensitiveKeys.some(pattern =>
          nameLower.includes(pattern)
        )

        if (isSensitive) {
          return `${varName}=***`
        }

        return match
      }
    )

    return masked
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): PrivacyConfig {
    return { ...this.config }
  }
}

// Singleton instance
let filterInstance: PrivacyFilter | null = null

export function getPrivacyFilter(): PrivacyFilter {
  if (!filterInstance) {
    filterInstance = new PrivacyFilter()
  }
  return filterInstance
}
