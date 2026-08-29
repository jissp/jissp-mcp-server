import { DynamicModule, Module } from '@nestjs/common';
import { MetadataScannerModule } from '@jissp/metadata-scanner';
import {
  McpServerFeatureOptions,
  McpServerRootOptions,
} from './mcp-server.types';
import {
  MCP_ENABLE_JSON_RESPONSE,
  McpServerController,
} from './mcp-server.controller';
import { McpMetadataRegistryService } from './mcp-metadata-registry.service';
import { McpServerService } from './mcp-server.service';
import {
  MCP_EXECUTION_INTERCEPTORS,
  McpExecutionInterceptor,
} from './interceptors';
import { McpAllowToolsModule } from './allow-tools';

@Module({})
export class McpServerModule {
  public static forRoot(options: McpServerRootOptions = {}): DynamicModule {
    const interceptorClasses = options.interceptors ?? [];

    return {
      global: true,
      module: McpServerModule,
      imports: [
        MetadataScannerModule,
        McpAllowToolsModule.forRoot(options.allowTools),
        ...(options.imports ?? []),
      ],
      controllers: [McpServerController],
      providers: [
        {
          provide: MCP_ENABLE_JSON_RESPONSE,
          useValue: options.enableJsonResponse ?? false,
        },
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
      imports: [...(options.imports ?? [])],
      providers: [...options.executors],
      exports: [...options.executors],
    };
  }
}
