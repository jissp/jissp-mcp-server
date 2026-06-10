import { Reflector } from '@nestjs/core';
import type { ZodType } from 'zod';

export interface McpToolInputSchema {
  type: 'object';
  /**
   * 각 property 의 타입을 Zod 로 정의한다.
   * SDK 가 이 스키마로 호출 인자를 검증한 뒤 executor 에 전달한다.
   * @example { stockCode: z.enum(['005930']), name: z.string() }
   */
  properties: Record<string, ZodType>;
  /**
   * 필수 property 키 목록.
   * 이 배열을 기준으로 required 여부가 결정되며, 배열에 없는 property 는
   * 내부적으로 `.optional()` 처리된다. (properties 에 직접 `.optional()` 을 쓰지 말 것)
   */
  required?: string[];
}

export interface McpToolOptions {
  name: string;
  description?: string;
  inputSchema?: McpToolInputSchema;
}

export const McpTool = Reflector.createDecorator<McpToolOptions>();
