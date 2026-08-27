import { DynamicModule, Module, Provider } from '@nestjs/common';
import { MetadataScannerModule } from '@jissp/metadata-scanner';
import {
  McpServerFeatureOptions,
  McpServerRootOptions,
} from './mcp-server.types';
import { McpServerController } from './mcp-server.controller';
import {
  MCP_STATELESS_OPTIONS,
  McpStatelessController,
} from './mcp-stateless.controller';
import { McpMetadataRegistryService } from './mcp-metadata-registry.service';
import { MCP_SESSION_OPTIONS, McpSessionStore } from './mcp-session.store';
import { McpServerService } from './mcp-server.service';
import {
  MCP_EXECUTION_INTERCEPTORS,
  McpExecutionInterceptor,
} from './interceptors';

@Module({})
export class McpServerModule {
  public static forRoot(options: McpServerRootOptions = {}): DynamicModule {
    const interceptorClasses = options.interceptors ?? [];
    const isStateless = options.mode === 'stateless';

    return {
      global: true,
      module: McpServerModule,
      imports: [MetadataScannerModule, ...(options.imports ?? [])],
      // 두 컨트롤러 모두 `/mcp` 경로를 잡으므로 모드에 맞는 하나만 등록한다.
      controllers: [isStateless ? McpStatelessController : McpServerController],
      providers: [
        ...McpServerModule.createModeProviders(options, isStateless),
        McpMetadataRegistryService,
        McpServerService,
        ...interceptorClasses,
        {
          provide: MCP_EXECUTION_INTERCEPTORS,
          useFactory: (...instances: McpExecutionInterceptor[]) => instances,
          inject: interceptorClasses,
        },
      ],
      exports: [],
    };
  }

  /**
   * 모드별로만 필요한 프로바이더를 만든다.
   * stateless 에는 보관할 세션이 없으므로 세션 저장소와 스위퍼를 아예 등록하지 않는다.
   */
  private static createModeProviders(
    options: McpServerRootOptions,
    isStateless: boolean,
  ): Provider[] {
    if (isStateless) {
      return [
        {
          provide: MCP_STATELESS_OPTIONS,
          useValue: options.stateless ?? {},
        },
      ];
    }

    return [
      {
        provide: MCP_SESSION_OPTIONS,
        useValue: options.session ?? {},
      },
      McpSessionStore,
    ];
  }

  public static forFeature(options: McpServerFeatureOptions): DynamicModule {
    return {
      module: McpServerModule,
      imports: [...(options.imports || [])],
      providers: [...options.executors],
      exports: [...options.executors],
    };
  }
}
