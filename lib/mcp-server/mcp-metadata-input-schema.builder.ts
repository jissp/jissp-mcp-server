import { Injectable } from '@nestjs/common';
import {
  ConstructorType,
  isConstructorType,
  MetadataScannerService,
  ScannedPropertyMetadata,
} from '@jissp/metadata-scanner';
import {
  InputSchemaProperties,
  InputSchemaProperty,
  JsonSchema,
  MCP_SCHEMA_PROPERTIES_METADATA,
  McpSchemaPropertyOptions,
  McpToolOptions,
} from './decorators';

@Injectable()
export class McpMetadataInputSchemaBuilder {
  constructor(
    private readonly metadataScannerService: MetadataScannerService,
  ) {}

  public build(mcpToolOptions: McpToolOptions) {
    if (!isConstructorType(mcpToolOptions.inputSchema)) {
      return mcpToolOptions.inputSchema;
    }

    return this.generateInputSchema(mcpToolOptions.inputSchema);
  }

  private generateInputSchema(inputSchemaClass: ConstructorType): JsonSchema {
    const properties =
      this.metadataScannerService.scanProperties<McpSchemaPropertyOptions>(
        MCP_SCHEMA_PROPERTIES_METADATA,
        inputSchemaClass,
      );

    return {
      type: 'object',
      properties: this.buildSchemaProperties(properties),
      required: this.buildRequired(properties),
    };
  }

  private buildSchemaProperties(
    propertiesMetadata: ScannedPropertyMetadata<McpSchemaPropertyOptions>[],
  ): InputSchemaProperties {
    const entries = propertiesMetadata.map(
      ({ key, metadata }): [string, InputSchemaProperty] => [
        key,
        {
          type: metadata.type,
          description: metadata.description,
        },
      ],
    );

    return Object.fromEntries(entries);
  }

  private buildRequired(
    propertiesMetadata: ScannedPropertyMetadata<McpSchemaPropertyOptions>[],
  ): string[] {
    const filteredEntries = propertiesMetadata.filter(
      ({ metadata: { isRequired } }) => {
        return isRequired;
      },
    );

    return filteredEntries.map(({ key }) => key);
  }
}
