import { Injectable } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { McpMetadataRegistryService } from './mcp-metadata-registry.service';

@Injectable()
export class McpServerService {
  constructor(private readonly registry: McpMetadataRegistryService) {}

  public createConfiguredServer(): Server {
    const server = new Server(
      { name: 'nestjs-mcp-server', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: this.registry.getTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema || {
          type: 'object' as const,
          properties: {},
        },
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const executor = this.registry.getToolExecutor(req.params.name);
      if (!executor) {
        throw new Error(`Tool not found: ${req.params.name}`);
      }
      const result = await executor.execute({
        jsonrpc: '2.0',
        id: undefined,
        method: 'tools/call',
        params: {
          name: req.params.name,
          arguments: req.params.arguments ?? {},
        },
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      };
    });

    server.setRequestHandler(ListResourcesRequestSchema, () => ({
      resources: this.registry.getResources(),
    }));

    server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
      const uri = req.params.uri;
      const match = this.registry.getResourceHandler(uri);
      if (!match) {
        throw new Error(`Resource not found: ${uri}`);
      }
      const result = await match.handler({
        jsonrpc: '2.0',
        id: undefined,
        method: 'resources/read',
        params: { arguments: match.params },
      });
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(result),
          },
        ],
      };
    });

    return server;
  }
}
