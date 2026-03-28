import { DynamicModule, Module } from '@nestjs/common';
import { MetadataScannerModule } from '@jissp/metadata-scanner';
import { McpServerFeatureOptions } from './mcp-server.types';
import { McpServerController } from './mcp-server.controller';
import { McpMetadataInputSchemaBuilder } from './mcp-metadata-input-schema.builder';
import { McpMetadataRegistryService } from './mcp-metadata-registry.service';
import { McpServerService } from './mcp-server.service';

@Module({})
export class McpServerModule {
  public static forRoot(): DynamicModule {
    return {
      global: true,
      module: McpServerModule,
      imports: [MetadataScannerModule],
      controllers: [McpServerController],
      providers: [
        McpMetadataRegistryService,
        McpMetadataInputSchemaBuilder,
        McpServerService,
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
