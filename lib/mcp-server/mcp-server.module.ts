import { DynamicModule, Module } from '@nestjs/common';
import { McpServerModuleOptions } from './mcp-server.types';
import { MetadataScannerModule } from '../metadata-scanner';
import { McpServerController } from './mcp-server.controller';
import { McpMetadataRegistryService } from './mcp-metadata-registry.service';
import { McpServerService } from './mcp-server.service';

@Module({})
export class McpServerModule {
  public static forRoot(options: McpServerModuleOptions): DynamicModule {
    return {
      global: true,
      module: McpServerModule,
      imports: [MetadataScannerModule],
      controllers: [McpServerController],
      providers: [
        McpMetadataRegistryService,
        McpServerService,
        ...options.executors,
      ],
      exports: [],
    };
  }
}
