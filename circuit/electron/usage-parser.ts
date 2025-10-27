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
  timeLeft: number; // minutes (until limit hit)
  resetTime: number; // minutes (until 5h window resets)
}

export class UsageParser {
  /**
   * Claude Code 세션 파일 위치 찾기 (실시간 활성 세션 감지)
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

      // 🔥 NEW: 실시간 활성 세션 감지 (최근 이벤트 기준)
      const dirs = await fs.readdir(claudeDir);
      let bestFile: string | null = null;
      let latestEventTime = 0;

      for (const dir of dirs) {
        const dirPath = path.join(claudeDir, dir);
        try {
          const files = await fs.readdir(dirPath);

          for (const file of files) {
            if (!file.endsWith('.jsonl')) continue;

            const filePath = path.join(dirPath, file);

            // 파일의 마지막 이벤트 timestamp 확인 (최적화: 마지막 8KB만 읽기)
            try {
              const stats = await fs.stat(filePath);
              const fileSize = stats.size;

              // 작은 파일은 전체 읽기, 큰 파일은 마지막 8KB만
              let content: string;
              if (fileSize < 8192) {
                content = await fs.readFile(filePath, 'utf-8');
              } else {
                const handle = await fs.open(filePath, 'r');
                try {
                  const buffer = Buffer.alloc(8192);
                  await handle.read(buffer, 0, 8192, fileSize - 8192);
                  content = buffer.toString('utf-8');
                } finally {
                  await handle.close();
                }
              }

              // 마지막 완전한 라인만 파싱
              const lines = content.trim().split('\n');
              if (lines.length === 0) continue;

              const lastLine = lines[lines.length - 1];
              const lastEvent: any = JSON.parse(lastLine);
              const eventTime = new Date(lastEvent.timestamp).getTime();

              // 5시간 이내의 최신 이벤트를 가진 파일 선택
              const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);

              if (eventTime > fiveHoursAgo && eventTime > latestEventTime) {
                latestEventTime = eventTime;
                bestFile = filePath;
              }
            } catch {
              // 파일 읽기 실패 시 skip
              continue;
            }
          }
        } catch {
          continue;
        }
      }

      if (bestFile) {
        const timeSince = Math.floor((Date.now() - latestEventTime) / 60000);
        console.log(`[UsageParser] Found active session: ${bestFile} (${timeSince}m ago)`);
        return bestFile;
      }

      // Fallback: 5시간 이내 활성 세션이 없으면 null 반환 (Mock 데이터 사용)
      console.warn('[UsageParser] No active session found within 5h window');
      return null;
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

      const now = Date.now();
      const cutoffTime = now - (hoursBack * 60 * 60 * 1000);

      let inputTokens = 0;
      let outputTokens = 0;
      let oldestEventTime: number | null = null;

      for (const line of lines) {
        try {
          const event: any = JSON.parse(line);
          const eventTime = new Date(event.timestamp).getTime();

          // 5시간 이내 이벤트만 카운트
          if (eventTime >= cutoffTime) {
            // Claude Code 구조: event.message.usage
            const usage = event.message?.usage || event.usage;
            if (usage) {
              inputTokens += usage.input_tokens || 0;
              outputTokens += usage.output_tokens || 0;

              // 가장 오래된 이벤트 추적
              if (oldestEventTime === null || eventTime < oldestEventTime) {
                oldestEventTime = eventTime;
              }
            }
          }
        } catch {
          continue; // 파싱 실패한 라인 스킵
        }
      }

      const totalTokens = inputTokens + outputTokens;
      const planLimit = this.detectPlanLimit(totalTokens);
      const burnRate = await this.calculateBurnRate(jsonlPath);
      const timeLeft = this.estimateTimeLeft(totalTokens, planLimit, burnRate);

      // 윈도우 리셋 시간 계산 (가장 오래된 토큰이 5시간 되는 시점)
      let resetTime = 0;
      if (oldestEventTime !== null) {
        const windowResetTime = oldestEventTime + (hoursBack * 60 * 60 * 1000);
        const minutesUntilReset = Math.max(0, Math.floor((windowResetTime - now) / 60000));
        resetTime = minutesUntilReset;
      }

      return {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
        percentage: (totalTokens / planLimit) * 100,
        planLimit,
        burnRate,
        timeLeft,
        resetTime
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
          const event: any = JSON.parse(line);
          const eventTime = new Date(event.timestamp).getTime();

          if (eventTime >= oneHourAgo) {
            const usage = event.message?.usage || event.usage;
            if (usage) {
              recentTokens +=
                (usage.input_tokens || 0) +
                (usage.output_tokens || 0);
            }
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
      timeLeft: 0,
      resetTime: 0
    };
  }
}
