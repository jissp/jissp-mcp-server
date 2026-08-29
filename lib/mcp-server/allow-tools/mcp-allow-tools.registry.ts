import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { MCP_ALLOW_TOOLS_POLICY } from './mcp-allow-tools.tokens';
import {
  McpAllowToolsPolicy,
  McpToolAllowEntry,
} from './mcp-allow-tools.types';

/**
 * 로드된 화이트리스트 정책의 조회 창구.
 * 정책의 자료구조와 "미설정 / 빈 목록" 구분은 이 클래스 안에 갇힌다.
 */
@Injectable()
export class McpAllowToolsRegistry {
  constructor(
    @Optional()
    @Inject(MCP_ALLOW_TOOLS_POLICY)
    private readonly policy: McpAllowToolsPolicy | null = null,
  ) {}

  /** 미설정(null)이면 모든 이름을 허용한다. 크기 0 인 정책은 아무것도 허용하지 않는다. */
  public isAllowed(name: string): boolean {
    return this.policy === null || this.policy.has(name);
  }

  public getAnnotations(name: string): ToolAnnotations | undefined {
    const entry = this.policy?.get(name);

    return entry ? this.toToolAnnotations(entry) : undefined;
  }

  /** 정책에 적힌 Tool 이름. 미설정이면 대조할 대상이 없으므로 빈 배열이다. */
  public getAllowedNames(): string[] {
    return this.policy === null ? [] : Array.from(this.policy.keys());
  }

  /**
   * 지정된 값만 SDK 키로 옮긴다.
   * 하나도 없으면 undefined 를 반환해, SDK 에 빈 객체가 전달되지 않게 한다.
   */
  private toToolAnnotations(
    entry: McpToolAllowEntry,
  ): ToolAnnotations | undefined {
    const annotations: ToolAnnotations = {};

    if (entry.readOnly !== undefined) {
      annotations.readOnlyHint = entry.readOnly;
    }
    if (entry.destructive !== undefined) {
      annotations.destructiveHint = entry.destructive;
    }

    return Object.keys(annotations).length > 0 ? annotations : undefined;
  }
}
