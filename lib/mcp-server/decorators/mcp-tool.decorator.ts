import { SetMetadata } from '@nestjs/common';

export const MCP_TOOL_METADATA = 'MCP_TOOL_METADATA';

export interface McpToolOptions {
  name: string;
  description?: string;
  inputSchema?: any; // JSON Schema
}

export const McpTool = (options: McpToolOptions) =>
  SetMetadata(MCP_TOOL_METADATA, options);
