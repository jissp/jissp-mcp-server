import { DynamicModule, Module } from '@nestjs/common';
import { readAllowToolsPolicy } from './mcp-allow-tools.policy';
import { McpAllowToolsRegistry } from './mcp-allow-tools.registry';
import { MCP_ALLOW_TOOLS_POLICY } from './mcp-allow-tools.tokens';
import { McpAllowToolsOptions } from './mcp-allow-tools.types';

@Module({})
export class McpAllowToolsModule {
  /** 옵션을 생략하면 정책이 없는 레지스트리를 등록해 모든 Tool 을 허용한다. */
  public static forRoot(options?: McpAllowToolsOptions): DynamicModule {
    return {
      module: McpAllowToolsModule,
      providers: [
        // useValue 로 두면 모듈 정의를 평가하는 시점에 파일을 읽어, 로드 실패가
        // Nest 컨테이너 초기화 에러로 보고되지 않는다.
        {
          provide: MCP_ALLOW_TOOLS_POLICY,
          useFactory: () => readAllowToolsPolicy(options),
        },
        McpAllowToolsRegistry,
      ],
      exports: [McpAllowToolsRegistry],
    };
  }
}
