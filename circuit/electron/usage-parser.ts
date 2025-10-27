/**
 * Usage Parser - 5시간 토큰 제한 추적
 * Claude Code의 5시간 롤링 윈도우 시스템 모니터링
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface UsageEvent {
  type: string;
  timestamp: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens?: number;
    cache_creation_tokens?: number;
  };
}

export interface UsageMetrics {
  input: number;
  output: number;
  total: number;
  percentage: number;
  planLimit: number;
  burnRate: number;
  timeLeft: number; // minutes
}

export class UsageParser {
  /**
   * Claude Code 세션 파일 위치 찾기
   */
  async findSessionFile(projectPath?: string): Promise<string | null> {
    try {
      const claudeDir = path.join(os.homedir(), '.claude', 'projects');

      // 프로젝트 경로가 주어진 경우, 해당 프로젝트의 세션 찾기
      if (projectPath) {
        const projectName = path.basename(projectPath);
        const dirs = await fs.readdir(claudeDir);

        for (const dir of dirs) {
          const sessionPath = path.join(claudeDir, dir, 'session.jsonl');
          try {
            await fs.access(sessionPath);
            return sessionPath;
          } catch {
            continue;
          }
        }
      }

      // 가장 최근 수정된 session.jsonl 찾기
      const dirs = await fs.readdir(claudeDir);
      let latestFile: string | null = null;
      let latestMtime = 0;

      for (const dir of dirs) {
        const sessionPath = path.join(claudeDir, dir, 'session.jsonl');
        try {
          const stats = await fs.stat(sessionPath);
          if (stats.mtimeMs > latestMtime) {
            latestMtime = stats.mtimeMs;
            latestFile = sessionPath;
          }
        } catch {
          continue;
        }
      }

      return latestFile;
    } catch (error) {
      console.error('[UsageParser] Error finding session file:', error);
      return null;
    }
  }

  /**
   * JSONL 파일에서 5시간 윈도우 토큰 사용량 계산
   */
  async parseUsage(jsonlPath: string, hoursBack: number = 5): Promise<UsageMetrics> {
    try {
      const content = await fs.readFile(jsonlPath, 'utf-8');
      const lines = content
        .split('\n')
        .filter(line => line.trim());

      const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);

      let inputTokens = 0;
      let outputTokens = 0;

      for (const line of lines) {
        try {
          const event: UsageEvent = JSON.parse(line);
          const eventTime = new Date(event.timestamp).getTime();

          // 5시간 이내 이벤트만 카운트
          if (eventTime >= cutoffTime && event.usage) {
            inputTokens += event.usage.input_tokens || 0;
            outputTokens += event.usage.output_tokens || 0;
          }
        } catch {
          continue; // 파싱 실패한 라인 스킵
        }
      }

      const totalTokens = inputTokens + outputTokens;
      const planLimit = this.detectPlanLimit(totalTokens);
      const burnRate = await this.calculateBurnRate(jsonlPath);
      const timeLeft = this.estimateTimeLeft(totalTokens, planLimit, burnRate);

      return {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
        percentage: (totalTokens / planLimit) * 100,
        planLimit,
        burnRate,
        timeLeft
      };
    } catch (error) {
      console.error('[UsageParser] Error parsing usage:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * 과거 최대 사용량으로 플랜 자동 감지
   */
  private detectPlanLimit(currentUsage: number): number {
    // 현재 사용량 기준으로 최소 플랜 추정
    if (currentUsage > 88000) return 220000;  // Max20
    if (currentUsage > 44000) return 88000;   // Max5
    return 44000;                              // Pro (default)
  }

  /**
   * 실시간 Burn Rate 계산 (tokens/hour)
   */
  async calculateBurnRate(jsonlPath: string): Promise<number> {
    try {
      const content = await fs.readFile(jsonlPath, 'utf-8');
      const lines = content
        .split('\n')
        .filter(line => line.trim());

      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      let recentTokens = 0;

      for (const line of lines) {
        try {
          const event: UsageEvent = JSON.parse(line);
          const eventTime = new Date(event.timestamp).getTime();

          if (eventTime >= oneHourAgo && event.usage) {
            recentTokens +=
              (event.usage.input_tokens || 0) +
              (event.usage.output_tokens || 0);
          }
        } catch {
          continue;
        }
      }

      return recentTokens;
    } catch (error) {
      console.error('[UsageParser] Error calculating burn rate:', error);
      return 0;
    }
  }

  /**
   * 예상 세션 종료 시간 (분)
   */
  private estimateTimeLeft(current: number, limit: number, burnRate: number): number {
    const remainingTokens = limit - current;
    if (burnRate === 0) return Infinity;

    const hoursLeft = remainingTokens / burnRate;
    return Math.max(0, Math.floor(hoursLeft * 60));
  }

  /**
   * 빈 메트릭 반환 (에러 시)
   */
  private getEmptyMetrics(): UsageMetrics {
    return {
      input: 0,
      output: 0,
      total: 0,
      percentage: 0,
      planLimit: 44000,
      burnRate: 0,
      timeLeft: 0
    };
  }
}
