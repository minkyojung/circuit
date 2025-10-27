/**
 * Metrics Manager - Usage & Context 통합 관리
 * File watcher + 실시간 메트릭 계산
 */

import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { UsageParser, UsageMetrics } from './usage-parser.js';
import { ContextTracker, ContextMetrics } from './context-tracker.js';

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
        console.warn('[MetricsManager] No session.jsonl found - using mock data for demo');

        // Mock 데이터로 UI 테스트
        const mockMetrics: CircuitMetrics = {
          usage: {
            input: 25000,
            output: 18500,
            total: 43500,
            percentage: 19.8,
            planLimit: 220000,
            burnRate: 8200,
            timeLeft: 192,
            resetTime: 206  // 3h 26m until window resets
          },
          context: {
            current: 165000,
            limit: 200000,
            percentage: 82.5,
            lastCompact: new Date(Date.now() - 2 * 60 * 60 * 1000),
            sessionStart: new Date(Date.now() - 5 * 60 * 60 * 1000),
            prunableTokens: 57750,
            shouldCompact: false
          },
          timestamp: Date.now()
        };

        this.lastMetrics = mockMetrics;
        this.emit('metrics-updated', mockMetrics);

        return;
      }

      this.currentSessionPath = sessionPath;
      console.log('[MetricsManager] Watching:', sessionPath);

      // 초기 메트릭 계산
      await this.updateMetrics();

      // File watcher 시작
      this.watcher = chokidar.watch(sessionPath, {
        persistent: true,
        ignoreInitial: true,
      });

      this.watcher.on('change', async () => {
        console.log('[MetricsManager] Session file changed, updating metrics...');
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
      const [usage, context] = await Promise.all([
        this.usageParser.parseUsage(this.currentSessionPath),
        this.contextTracker.calculateContext(this.currentSessionPath),
      ]);

      const metrics: CircuitMetrics = {
        usage,
        context,
        timestamp: Date.now()
      };

      this.lastMetrics = metrics;

      // Frontend에 메트릭 전송
      this.emit('metrics-updated', metrics);

      console.log('[MetricsManager] Metrics updated:', {
        usage: `${metrics.usage.total}/${metrics.usage.planLimit} (${metrics.usage.percentage.toFixed(1)}%)`,
        context: `${metrics.context.current}/${metrics.context.limit} (${metrics.context.percentage.toFixed(1)}%)`
      });

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
      console.log('[MetricsManager] Watcher stopped');
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
