import { createPropertyDecorator } from '@jissp/metadata-scanner';

export const MCP_SCHEMA_PROPERTIES_METADATA = 'MCP_SCHEMA_PROPERTIES_METADATA';

export interface McpSchemaPropertyOptions {
  type: string;
  description: string;
  isRequired: boolean;
}

export const McpSchemaProperty =
  createPropertyDecorator<McpSchemaPropertyOptions>(
    MCP_SCHEMA_PROPERTIES_METADATA,
  );
