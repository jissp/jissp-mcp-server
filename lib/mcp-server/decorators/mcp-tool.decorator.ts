import { SetMetadata } from '@nestjs/common';
import 'reflect-metadata';
import {
  getMcpSchemaPropertiesMetadata,
  McpSchemaPropertyOptions,
  McpSchemaPropertyOptionsMap,
} from './mcp-schema-property.decorator';

export const MCP_TOOL_METADATA = 'MCP_TOOL_METADATA';

type ConstructorType = new (...args: any[]) => any;

export interface McpToolOptions {
  name: string;
  description?: string;
  inputSchema?: JsonSchema | ConstructorType;
}

export interface JsonSchema {
  type: 'object';
  properties: InputSchemaProperties;
  required?: string[];
}

interface InputSchemaProperty {
  type: string;
  description?: string;
}
type InputSchemaProperties = Record<string, InputSchemaProperty>;

export const McpTool = (options: McpToolOptions) => {
  if (isConstructorType(options.inputSchema)) {
    options.inputSchema = generateInputSchema(options.inputSchema);
  }

  return SetMetadata(MCP_TOOL_METADATA, options);
};

function isConstructorType(value: any): value is ConstructorType {
  return typeof value === 'function';
}

function generateInputSchema(inputSchemaClass: ConstructorType): JsonSchema {
  const schemaPropertyEntries = schemaPropertiesToEntries(
    getMcpSchemaPropertiesMetadata(inputSchemaClass.prototype),
  );

  const properties: InputSchemaProperties = buildSchemaProperties(
    schemaPropertyEntries,
  );
  const required = buildRequired(schemaPropertyEntries);

  return {
    type: 'object',
    properties,
    required: required,
  };
}

function schemaPropertiesToEntries(
  schemaProperties: McpSchemaPropertyOptionsMap,
) {
  const schemaPropertiesEntries: [string, McpSchemaPropertyOptions][] = [];

  schemaProperties.forEach((value, key) => {
    schemaPropertiesEntries.push([key, value]);
  });

  return schemaPropertiesEntries;
}

function buildSchemaProperties(entries: [string, McpSchemaPropertyOptions][]) {
  const propertyEntries = entries.map(
    ([key, { type, description }]): [string, InputSchemaProperty] => [
      key,
      {
        type,
        description,
      },
    ],
  );

  return Object.fromEntries(propertyEntries);
}

function buildRequired(
  entries: [string, McpSchemaPropertyOptions][],
): string[] {
  const filteredEntries = entries.filter(([, value]) => value.isRequired);

  return filteredEntries.map(([name]) => name);
}
