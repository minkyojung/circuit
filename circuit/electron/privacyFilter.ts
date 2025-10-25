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
  maxParamSize: number
  retention: {
    days: number
    maxCalls: number
  }
}

export const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  maskFilePaths: true,
  maskEnvVars: true,
  maskCredentials: true,
  maxParamSize: 100 * 1024,
  retention: {
    days: 7,
    maxCalls: 10000,
  },
}

export class PrivacyFilter {
  private config: PrivacyConfig

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

  private readonly filePathPatterns = [
    /\/Users\/[^\/\s]+/g,
    /\/home\/[^\/\s]+/g,
    /C:\\Users\\[^\\\/\s]+/gi,
  ]

  constructor(config: PrivacyConfig = DEFAULT_PRIVACY_CONFIG) {
    this.config = config
  }

  sanitizeCall(call: any): any {
    const sanitized = { ...call }

    if (this.config.maskFilePaths) {
      if (typeof sanitized.requestParams === 'string') {
        sanitized.requestParams = this.maskPaths(sanitized.requestParams)
      }
      if (typeof sanitized.responseResult === 'string') {
        sanitized.responseResult = this.maskPaths(sanitized.responseResult)
      }
    }

    if (this.config.maskCredentials) {
      if (typeof sanitized.requestParams === 'string') {
        try {
          const parsed = JSON.parse(sanitized.requestParams)
          const masked = this.maskSensitiveKeys(parsed)
          sanitized.requestParams = JSON.stringify(masked)
        } catch (error) {
          sanitized.requestParams = this.maskSensitiveInString(sanitized.requestParams)
        }
      }
    }

    if (this.config.maskEnvVars) {
      if (typeof sanitized.requestParams === 'string') {
        sanitized.requestParams = this.maskEnvVars(sanitized.requestParams)
      }
    }

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

  private maskPaths(str: string): string {
    let masked = str

    for (const pattern of this.filePathPatterns) {
      masked = masked.replace(pattern, (match) => {
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

  private maskSensitiveKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskSensitiveKeys(item))
    }

    const masked: any = {}

    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase()
      const isSensitive = this.sensitiveKeys.some(pattern =>
        keyLower.includes(pattern.toLowerCase())
      )

      if (isSensitive && typeof value === 'string') {
        masked[key] = '***'
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveKeys(value)
      } else {
        masked[key] = value
      }
    }

    return masked
  }

  private maskSensitiveInString(str: string): string {
    let masked = str

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

  private maskEnvVars(str: string): string {
    let masked = str

    masked = masked.replace(
      /\b([A-Z_]+)\s*=\s*["']?([^"'\s,}]+)/g,
      (match, varName, value) => {
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

  setConfig(config: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): PrivacyConfig {
    return { ...this.config }
  }
}

let filterInstance: PrivacyFilter | null = null

export function getPrivacyFilter(): PrivacyFilter {
  if (!filterInstance) {
    filterInstance = new PrivacyFilter()
  }
  return filterInstance
}
