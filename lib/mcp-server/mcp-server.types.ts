import { ModuleMetadata, Provider, Type } from '@nestjs/common';
import { BaseExecutor, ExecutorExtra } from './base.executor';
import { McpExecutionInterceptor } from './interceptors';
import { McpAllowToolsOptions } from './allow-tools';

export interface McpServerRootOptions extends Pick<ModuleMetadata, 'imports'> {
  /** 실행 인터셉터 (배열 순서 = 바깥→안쪽 실행 순서) */
  interceptors?: Type<McpExecutionInterceptor>[];
  /**
   * SSE 스트림 대신 단일 JSON 응답을 반환한다. (기본 false)
   *
   * 요청과 응답이 1:1 이라 스트림이 필요 없고, JSON 응답으로 두면 CloudFront 같은
   * 중간 프록시의 SSE 버퍼링 문제를 피할 수 있다.
   */
  enableJsonResponse?: boolean;
  /**
   * 공개할 Tool 화이트리스트. 미지정 시 선언된 모든 Tool 이 공개된다.
   * 지정하면 파일에 명시된 Tool 만 공개되며, 설정 오류는 부팅 실패로 이어진다.
   */
  allowTools?: McpAllowToolsOptions;
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
