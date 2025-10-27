/**
 * Metrics Manager - Usage & Context 통합 관리
 * File watcher + 실시간 메트릭 계산
 */

import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { UsageParser, UsageMetrics } from './usage-parser.js';
import { ContextTracker, ContextMetrics as ContextMetricsInternal } from './context-tracker.js';

// Frontend용 ContextMetrics (Date → string 변환)
export interface ContextMetrics {
  current: number;
  limit: number;
  percentage: number;
  lastCompact: string | null;
  sessionStart: string;
  prunableTokens: number;
  shouldCompact: boolean;
}

export interface CircuitMetrics {
  usage: UsageMetrics;
  context: ContextMetrics;
  timestamp: number;
}

export class MetricsManager extends EventEmitter {
  private usageParser: UsageParser;
  private contextTracker: ContextTracker;
  private watcher: chokidar.FSWatcher | null = null;
  private currentSessionPath: string | null = null;
  private lastMetrics: CircuitMetrics | null = null;

  constructor() {
    super();
    this.usageParser = new UsageParser();
    this.contextTracker = new ContextTracker();
  }

  /**
   * 모니터링 시작
   */
  async start(projectPath?: string): Promise<void> {
    try {
      // 세션 파일 찾기
      const sessionPath = await this.usageParser.findSessionFile(projectPath);

      if (!sessionPath) {
        console.warn('[MetricsManager] ⚠️  No active Claude Code session found (within 5h)');
        console.warn('[MetricsManager] Please start Claude Code or wait for session activity');

        // 빈 메트릭 반환 (Mock 대신)
        const emptyMetrics: CircuitMetrics = {
          usage: {
            input: 0,
            output: 0,
            total: 0,
            percentage: 0,
            planLimit: 44000,
            burnRate: 0,
            timeLeft: 0,
            resetTime: 0
          },
          context: {
            current: 0,
            limit: 200000,
            percentage: 0,
            lastCompact: null,
            sessionStart: new Date().toISOString(),
            prunableTokens: 0,
            shouldCompact: false
          },
          timestamp: Date.now()
        };

        this.lastMetrics = emptyMetrics;
        this.emit('metrics-updated', emptyMetrics);

        // 5초 후 재시도
        setTimeout(() => {
          this.start(projectPath).catch(console.error);
        }, 5000);

        return;
      }

      this.currentSessionPath = sessionPath;

      // 초기 메트릭 계산
      await this.updateMetrics();

      // File watcher 시작
      this.watcher = chokidar.watch(sessionPath, {
        persistent: true,
        ignoreInitial: true,
      });

      this.watcher.on('change', async () => {
        await this.updateMetrics();
      });

      this.watcher.on('error', (error) => {
        console.error('[MetricsManager] Watcher error:', error);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('[MetricsManager] Start error:', error);
      this.emit('error', error);
    }
  }

  /**
   * 메트릭 업데이트
   */
  private async updateMetrics(): Promise<void> {
    if (!this.currentSessionPath) {
      console.warn('[MetricsManager] No session path set');
      return;
    }

    try {
      // Usage와 Context 동시 계산
      const [usage, contextRaw] = await Promise.all([
        this.usageParser.parseUsage(this.currentSessionPath),
        this.contextTracker.calculateContext(this.currentSessionPath),
      ]);

      // Date 객체를 ISO string으로 변환 (Frontend와 타입 일치)
      const context = {
        ...contextRaw,
        lastCompact: contextRaw.lastCompact ? contextRaw.lastCompact.toISOString() : null,
        sessionStart: contextRaw.sessionStart.toISOString()
      };

      const metrics: CircuitMetrics = {
        usage,
        context,
        timestamp: Date.now()
      };

      this.lastMetrics = metrics;

      // Frontend에 메트릭 전송
      this.emit('metrics-updated', metrics);

    } catch (error) {
      console.error('[MetricsManager] Error updating metrics:', error);
      this.emit('error', error);
    }
  }

  /**
   * 현재 메트릭 가져오기 (캐시된 값)
   */
  getCurrentMetrics(): CircuitMetrics | null {
    return this.lastMetrics;
  }

  /**
   * 메트릭 강제 새로고침
   */
  async refresh(): Promise<CircuitMetrics | null> {
    await this.updateMetrics();
    return this.lastMetrics;
  }

  /**
   * 모니터링 중지
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

// Singleton instance
let metricsManagerInstance: MetricsManager | null = null;

export function getMetricsManager(): MetricsManager {
  if (!metricsManagerInstance) {
    metricsManagerInstance = new MetricsManager();
  }
  return metricsManagerInstance;
}
