import { ModuleMetadata, Provider, Type } from '@nestjs/common';
import { BaseExecutor, ExecutorExtra } from './base.executor';
import { McpExecutionInterceptor } from './interceptors';

export interface McpServerConfig {
  name: string;
  version: string;
  description?: string;
}

/**
 * 세션 처리 방식.
 *
 * - `stateful`: 세션(`mcp-session-id`)마다 `McpServer` 를 만들어 메모리에 보관한다.
 *   서버→클라이언트 알림(SSE)·sampling·elicitation 을 쓸 수 있지만, 세션 저장소와
 *   idle TTL 정리가 필요하고 로드밸런서 뒤에서는 세션 어피니티를 요구한다.
 * - `stateless`: 요청마다 `McpServer` 를 만들고 응답이 끝나면 즉시 폐기한다.
 *   보관하는 세션이 없어 누수가 구조적으로 불가능하고 수평 확장이 자유롭다.
 *   대신 서버→클라이언트 방향 통신(`extra.sendNotification` / `extra.sendRequest`)을
 *   쓸 수 없고 `extra.sessionId` 는 항상 `undefined` 다.
 */
export type McpServerMode = 'stateful' | 'stateless';

export interface McpStatelessOptions {
  /**
   * SSE 스트림 대신 단일 JSON 응답을 반환한다. (기본 false)
   *
   * stateless 는 요청과 응답이 1:1 이라 스트림이 필요 없고, JSON 응답으로 두면
   * CloudFront 같은 중간 프록시의 SSE 버퍼링 문제를 피할 수 있다.
   */
  enableJsonResponse?: boolean;
}

export interface McpSessionOptions {
  /**
   * 마지막 요청 이후 이 시간이 지난 세션을 정리한다. (기본 30분)
   * 0 이하로 두면 자동 정리를 끄고 클라이언트의 DELETE 요청에만 의존한다.
   */
  idleTimeoutMs?: number;
  /** 만료 세션을 검사하는 주기 (기본 1분) */
  sweepIntervalMs?: number;
}

export interface McpServerRootOptions extends Pick<ModuleMetadata, 'imports'> {
  /**
   * 세션 처리 방식. (기본 `'stateful'`)
   * 기본값은 기존 동작을 그대로 유지하므로, 이 옵션을 지정하지 않으면 변화가 없다.
   */
  mode?: McpServerMode;
  /** 실행 인터셉터 (배열 순서 = 바깥→안쪽 실행 순서) */
  interceptors?: Type<McpExecutionInterceptor>[];
  /** 세션 정리 정책. `mode: 'stateless'` 에서는 보관하는 세션이 없으므로 무시된다. */
  session?: McpSessionOptions;
  /** stateless 전용 설정. `mode: 'stateful'` 에서는 무시된다. */
  stateless?: McpStatelessOptions;
}

export interface McpServerFeatureOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  executors: Provider<BaseExecutor>[];
}

/** resource URI 템플릿에서 추출된 변수 */
export type McpResourceVariables = Record<string, string | string[]>;

export type McpResourceHandler<T = unknown> = (
  variables: McpResourceVariables,
  extra: ExecutorExtra,
) => T | Promise<T>;
