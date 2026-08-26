import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpSessionOptions } from './mcp-server.types';

/** McpSessionStore 가 주입받는 세션 옵션 토큰 */
export const MCP_SESSION_OPTIONS = Symbol('MCP_SESSION_OPTIONS');

/** 마지막 요청 이후 30분간 사용되지 않은 세션을 만료 대상으로 본다. */
export const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** 만료 세션 검사 주기 */
export const DEFAULT_SWEEP_INTERVAL_MS = 60 * 1000;

interface McpSession {
  transport: StreamableHTTPServerTransport;
  /** 마지막으로 이 세션의 요청을 처리한 시각 */
  lastAccessedAt: number;
}

/**
 * sessionId 별 트랜스포트 저장소.
 *
 * 트랜스포트는 클라이언트가 DELETE 를 보낼 때만 `close()` 되므로, 탭이 닫히거나
 * 프록시 구간에서 연결이 끊긴 세션은 스스로 사라지지 않는다. 세션 하나가 McpServer
 * 인스턴스를 통째로 붙들고 있어 그대로 두면 heap 이 세션 수에 비례해 늘어난다.
 * 이 저장소는 idle 상태가 오래된 세션을 주기적으로 닫아 그 누적을 끊는다.
 */
@Injectable()
export class McpSessionStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpSessionStore.name);
  private readonly sessions = new Map<string, McpSession>();
  private readonly idleTimeoutMs: number;
  private readonly sweepIntervalMs: number;
  private sweeper?: NodeJS.Timeout;

  constructor(
    @Optional()
    @Inject(MCP_SESSION_OPTIONS)
    options: McpSessionOptions = {},
  ) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.sweepIntervalMs = options.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
  }

  onModuleInit() {
    if (this.idleTimeoutMs <= 0) {
      return;
    }

    this.sweeper = setInterval(() => this.sweep(), this.sweepIntervalMs);
    // 스위퍼가 프로세스 종료를 막지 않도록 이벤트 루프 대기에서 제외한다.
    this.sweeper.unref?.();
  }

  /** 애플리케이션 종료 시 살아있는 세션을 모두 닫는다. */
  async onModuleDestroy() {
    if (this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = undefined;
    }

    const transports = Array.from(
      this.sessions.values(),
      (session) => session.transport,
    );
    this.sessions.clear();

    await Promise.allSettled(transports.map((transport) => transport.close()));
  }

  /** 현재 보관 중인 세션 수 (모니터링용) */
  get size(): number {
    return this.sessions.size;
  }

  add(sessionId: string, transport: StreamableHTTPServerTransport) {
    this.sessions.set(sessionId, { transport, lastAccessedAt: Date.now() });
  }

  /**
   * 세션을 조회하면서 마지막 사용 시각을 갱신한다.
   * 요청을 처리했다는 것 자체가 세션이 살아있다는 신호이므로 조회 시점에 함께 갱신한다.
   */
  get(sessionId: string): StreamableHTTPServerTransport | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    session.lastAccessedAt = Date.now();

    return session.transport;
  }

  remove(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  /**
   * idle 상태가 임계치를 넘은 세션을 닫는다.
   * `close()` 가 트랜스포트의 onclose 를 호출하고, 그 핸들러가 이 저장소에서 세션을
   * 제거한다. 제거 경로를 onclose 하나로 유지하기 위해 여기서 직접 지우지 않는다.
   */
  private sweep() {
    const now = Date.now();
    let closedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      const idleDuration = now - session.lastAccessedAt;
      if (idleDuration < this.idleTimeoutMs) {
        continue;
      }

      closedCount += 1;
      void this.closeExpired(sessionId, session.transport);
    }

    if (closedCount > 0) {
      this.logger.log(
        `idle 세션 ${closedCount}개를 정리했습니다. (남은 세션 ${this.sessions.size}개)`,
      );
    }
  }

  private async closeExpired(
    sessionId: string,
    transport: StreamableHTTPServerTransport,
  ) {
    try {
      await transport.close();
    } catch (error) {
      this.logger.warn(
        `세션 ${sessionId} 정리에 실패했습니다: ${(error as Error).message}`,
      );
    } finally {
      // close() 가 실패해 onclose 가 불리지 않더라도 저장소에는 남기지 않는다.
      this.sessions.delete(sessionId);
    }
  }
}
