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
        this.toInputSchemaProperty(metadata),
      ],
    );

    return Object.fromEntries(entries);
  }

  private toInputSchemaProperty(
    options: McpSchemaPropertyOptions,
  ): InputSchemaProperty {
    const property: InputSchemaProperty = {
      type: options.type,
      description: options.description,
    };

    if (options.enum) {
      property.enum = options.enum;
    }

    if (options.items !== undefined) {
      property.items = isConstructorType(options.items)
        ? this.generateInputSchema(options.items)
        : options.items;
    }

    if (
      options.properties !== undefined &&
      isConstructorType(options.properties)
    ) {
      const nested = this.generateInputSchema(options.properties);
      property.properties = nested.properties;
      if (nested.required && nested.required.length > 0) {
        property.required = nested.required;
      }
    }

    return property;
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
