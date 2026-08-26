import { DynamicModule, Module } from '@nestjs/common';
import { MetadataScannerModule } from '@jissp/metadata-scanner';
import {
  McpServerFeatureOptions,
  McpServerRootOptions,
} from './mcp-server.types';
import { McpServerController } from './mcp-server.controller';
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

    return {
      global: true,
      module: McpServerModule,
      imports: [MetadataScannerModule, ...(options.imports ?? [])],
      controllers: [McpServerController],
      providers: [
        {
          provide: MCP_SESSION_OPTIONS,
          useValue: options.session ?? {},
        },
        McpSessionStore,
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

  public static forFeature(options: McpServerFeatureOptions): DynamicModule {
    return {
      module: McpServerModule,
      imports: [...(options.imports || [])],
      providers: [...options.executors],
      exports: [...options.executors],
    };
  }
}
