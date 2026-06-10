import { ModuleMetadata, Provider, Type } from '@nestjs/common';
import { BaseExecutor, ExecutorExtra } from './base.executor';
import { McpExecutionInterceptor } from './interceptors';

export interface McpServerConfig {
  name: string;
  version: string;
  description?: string;
}

export interface McpServerRootOptions extends Pick<ModuleMetadata, 'imports'> {
  /** 실행 인터셉터 (배열 순서 = 바깥→안쪽 실행 순서) */
  interceptors?: Type<McpExecutionInterceptor>[];
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
