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
   * 세션 전체 컨텍스트 계산 (최적화: 단일 패스)
   */
  async calculateContext(jsonlPath: string): Promise<ContextMetrics> {
    try {
      const content = await fs.readFile(jsonlPath, 'utf-8');
      const lines = content
        .split('\n')
        .filter(line => line.trim());

      // 단일 패스로 모든 정보 수집
      const result = this.analyzeLinesOptimized(lines);

      const startTime = result.lastCompact || result.sessionStart;
      const adjustedContext = Math.floor(result.totalTokens * this.SYSTEM_OVERHEAD);
      const percentage = (adjustedContext / this.CONTEXT_LIMIT) * 100;
      const prunableTokens = this.estimatePrunableTokens(adjustedContext);
      const shouldCompact = percentage >= this.COMPACT_THRESHOLD;

      return {
        current: adjustedContext,
        limit: this.CONTEXT_LIMIT,
        percentage,
        lastCompact: result.lastCompact,
        sessionStart: result.sessionStart,
        prunableTokens,
        shouldCompact
      };
    } catch (error) {
      console.error('[ContextTracker] Error calculating context:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * 최적화된 단일 패스 분석
   */
  private analyzeLinesOptimized(lines: string[]): {
    sessionStart: Date;
    lastCompact: Date | null;
    totalTokens: number;
  } {
    let sessionStart: Date | null = null;
    let lastCompactCommand: { timestamp: Date; index: number } | null = null;
    let totalTokens = 0;
    const tokensAtIndex: Map<number, number> = new Map();

    // 단일 패스로 모든 데이터 수집
    for (let i = 0; i < lines.length; i++) {
      try {
        const event: any = JSON.parse(lines[i]);
        const timestamp = new Date(event.timestamp);

        // 세션 시작 감지
        if (!sessionStart) {
          if (event.type === 'session_start') {
            sessionStart = timestamp;
          } else if (i === 0) {
            sessionStart = timestamp;
          }
        }

        // /compact 명령 감지 (정확한 매칭)
        if (event.type === 'user') {
          const content = Array.isArray(event.message?.content)
            ? event.message.content.find((c: any) => typeof c === 'string' || c?.type === 'text')
            : event.message?.content;

          const textContent = typeof content === 'string' ? content : content?.text || '';

          // 정확히 /compact 명령만 감지 (다른 "compact" 단어는 무시)
          if (textContent.trim() === '/compact') {
            lastCompactCommand = { timestamp, index: i };
          }
        }

        // 토큰 수집
        const usage = event.message?.usage || event.usage;
        if (usage) {
          const tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
          tokensAtIndex.set(i, tokens);
          totalTokens += tokens;
        }
      } catch {
        continue;
      }
    }

    // compact 검증 (전후 토큰 비교 - 완화된 기준)
    let verifiedCompact: Date | null = null;
    if (lastCompactCommand) {
      const tokensBeforeCompact: number[] = [];
      const tokensAfterCompact: number[] = [];

      for (const [index, tokens] of tokensAtIndex.entries()) {
        if (index < lastCompactCommand.index && index > lastCompactCommand.index - 5) {
          tokensBeforeCompact.push(tokens);
        } else if (index > lastCompactCommand.index && index < lastCompactCommand.index + 10) {
          tokensAfterCompact.push(tokens);
        }
      }

      // 토큰 감소 확인 (10% 이상 감소면 유효한 compact로 인정)
      if (tokensBeforeCompact.length > 0 && tokensAfterCompact.length > 0) {
        const avgBefore = tokensBeforeCompact.reduce((a, b) => a + b, 0) / tokensBeforeCompact.length;
        const avgAfter = tokensAfterCompact.reduce((a, b) => a + b, 0) / tokensAfterCompact.length;
        const reductionRate = (avgBefore - avgAfter) / avgBefore;

        if (reductionRate >= 0.1) {  // 10% 이상 감소
          verifiedCompact = lastCompactCommand.timestamp;
        }
      } else if (lastCompactCommand) {
        // 토큰 데이터가 없으면 /compact 명령만으로도 인정 (최근 5분 이내)
        const timeSinceCompact = Date.now() - lastCompactCommand.timestamp.getTime();
        if (timeSinceCompact < 5 * 60 * 1000) {  // 5분 이내
          verifiedCompact = lastCompactCommand.timestamp;
        }
      }
    }

    return {
      sessionStart: sessionStart || new Date(),
      lastCompact: verifiedCompact,
      totalTokens
    };
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
