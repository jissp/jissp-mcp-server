import { ModuleMetadata, Provider, Type } from '@nestjs/common';
import { BaseExecutor, ExecutorExtra } from './base.executor';
import { McpExecutionInterceptor } from './interceptors';

export interface McpServerConfig {
  name: string;
  version: string;
  description?: string;
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
  /** 실행 인터셉터 (배열 순서 = 바깥→안쪽 실행 순서) */
  interceptors?: Type<McpExecutionInterceptor>[];
  /** 세션 정리 정책 */
  session?: McpSessionOptions;
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
