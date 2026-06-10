import type { ExecutorExtra } from '../base.executor';

/** 실행 종류 — Tool 호출인지 Resource 읽기인지 구분 */
export enum McpExecutionKind {
  Tool = 'tool',
  Resource = 'resource',
}

export interface McpExecutionContext<TArgs = unknown> {
  /** 실행 종류 */
  kind: McpExecutionKind;
  /** tool name 또는 resource uri */
  name: string;
  /** tool/resource 입력 인자 */
  arguments: TArgs;
  /** MCP SDK 가 전달하는 실행 컨텍스트 (authInfo 등 포함) */
  extra: ExecutorExtra;
}

/** 다음 인터셉터 또는 최종 실행(executor/handler)을 호출하는 핸들러 */
export type McpExecutionHandler<T = unknown> = () => Promise<T>;

export interface McpExecutionInterceptor {
  /**
   * 실행을 감싼다. 반드시 `next()` 의 반환값을 그대로 반환해야 한다.
   *
   * - `next()` 를 호출하지 않으면 실제 실행이 누락된다.
   * - 통과시키려면 `return next()`, 차단하려면 `throw` 한다(SDK 가 JSON-RPC 에러로 변환).
   *
   * @example
   * intercept(ctx, next) {
   *   if (!ctx.extra.authInfo) throw new Error('Unauthorized');
   *   return next();
   * }
   */
  intercept<T>(
    context: McpExecutionContext,
    next: McpExecutionHandler<T>,
  ): Promise<T>;
}
