/**
 * Context Tracker - 세션 컨텍스트 추적
 * Claude의 200k context window 모니터링
 */

import * as fs from 'fs/promises';

interface UsageEvent {
  type: string;
  timestamp: string;
  content?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ContextMetrics {
  current: number;
  limit: number;
  percentage: number;
  lastCompact: Date | null;
  sessionStart: Date;
  prunableTokens: number;
  shouldCompact: boolean;
}

export class ContextTracker {
  private readonly CONTEXT_LIMIT = 200000; // Sonnet 4.5 limit
  private readonly COMPACT_THRESHOLD = 85; // 85%에서 compact 권장
  private readonly SYSTEM_OVERHEAD = 1.05; // 5% 시스템 프롬프트 오버헤드

  /**
   * 세션 전체 컨텍스트 계산
   */
  async calculateContext(jsonlPath: string): Promise<ContextMetrics> {
    try {
      const content = await fs.readFile(jsonlPath, 'utf-8');
      const lines = content
        .split('\n')
        .filter(line => line.trim());

      const sessionStart = this.findSessionStart(lines);
      const lastCompact = this.findLastCompact(lines);

      // 계산 시작점 결정 (마지막 compact 또는 세션 시작)
      const startTime = lastCompact || sessionStart;

      let contextTokens = 0;

      for (const line of lines) {
        try {
          const event: any = JSON.parse(line);
          const eventTime = new Date(event.timestamp).getTime();

          // 시작점 이후의 토큰만 누적
          if (eventTime >= startTime.getTime()) {
            const usage = event.message?.usage || event.usage;
            if (usage) {
              contextTokens +=
                (usage.input_tokens || 0) +
                (usage.output_tokens || 0);
            }
          }
        } catch {
          continue;
        }
      }

      // 시스템 프롬프트 오버헤드 추정
      const adjustedContext = Math.floor(contextTokens * this.SYSTEM_OVERHEAD);
      const percentage = (adjustedContext / this.CONTEXT_LIMIT) * 100;
      const prunableTokens = this.estimatePrunableTokens(adjustedContext);
      const shouldCompact = percentage >= this.COMPACT_THRESHOLD;

      return {
        current: adjustedContext,
        limit: this.CONTEXT_LIMIT,
        percentage,
        lastCompact,
        sessionStart,
        prunableTokens,
        shouldCompact
      };
    } catch (error) {
      console.error('[ContextTracker] Error calculating context:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * 세션 시작 시점 탐지
   */
  private findSessionStart(lines: string[]): Date {
    for (const line of lines) {
      try {
        const event: UsageEvent = JSON.parse(line);
        if (event.type === 'session_start') {
          return new Date(event.timestamp);
        }
      } catch {
        continue;
      }
    }

    // fallback: 첫 이벤트 시간
    try {
      const firstEvent = JSON.parse(lines[0]);
      return new Date(firstEvent.timestamp);
    } catch {
      return new Date();
    }
  }

  /**
   * 마지막 /compact 명령 탐지
   */
  private findLastCompact(lines: string[]): Date | null {
    // 역순으로 검색 (최신 compact 먼저)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const event: UsageEvent = JSON.parse(lines[i]);

        // /compact 명령 감지
        if (event.type === 'user_message' &&
            event.content?.includes('/compact')) {
          return new Date(event.timestamp);
        }

        // compact 이벤트 직접 감지
        if (event.type === 'compact_complete') {
          return new Date(event.timestamp);
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Prunable 토큰 추정 (압축 가능한 양)
   * 일반적으로 30-40% 압축 가능
   */
  private estimatePrunableTokens(currentContext: number): number {
    return Math.floor(currentContext * 0.35);
  }

  /**
   * 빈 메트릭 반환 (에러 시)
   */
  private getEmptyMetrics(): ContextMetrics {
    return {
      current: 0,
      limit: this.CONTEXT_LIMIT,
      percentage: 0,
      lastCompact: null,
      sessionStart: new Date(),
      prunableTokens: 0,
      shouldCompact: false
    };
  }

  /**
   * 시간 차이 포맷팅 (예: "2h ago", "30m ago")
   */
  static formatTimeSince(date: Date | null): string {
    if (!date) return 'Never';

    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }
}
