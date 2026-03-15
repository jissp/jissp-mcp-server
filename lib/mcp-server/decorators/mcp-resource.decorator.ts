import { SetMetadata } from '@nestjs/common';

export const MCP_RESOURCE_METADATA = 'MCP_RESOURCE_METADATA';

export interface McpResourceOptions {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export const McpResource = (options: McpResourceOptions) =>
  SetMetadata(MCP_RESOURCE_METADATA, options);
