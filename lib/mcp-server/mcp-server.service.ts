import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShape } from 'zod';
import { McpToolInputSchema } from './decorators';
import { McpMetadataRegistryService } from './mcp-metadata-registry.service';
import {
  MCP_EXECUTION_INTERCEPTORS,
  McpExecutionContext,
  McpExecutionHandler,
  McpExecutionInterceptor,
  McpExecutionKind,
} from './interceptors';

@Injectable()
export class McpServerService {
  constructor(
    private readonly registry: McpMetadataRegistryService,
    @Optional()
    @Inject(MCP_EXECUTION_INTERCEPTORS)
    private readonly interceptors: McpExecutionInterceptor[] = [],
  ) {}

  public createConfiguredServer(): McpServer {
    const server = new McpServer(
      { name: 'nestjs-mcp-server', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {} } },
    );

    this.registerTools(server);
    this.registerResources(server);

    return server;
  }

  /** registry 에 등록된 tool 들을 McpServer 에 등록한다. 각 실행은 인터셉터 체인으로 감싼다. */
  private registerTools(server: McpServer) {
    for (const { metadata, executor } of this.registry.getToolEntries()) {
      server.registerTool(
        metadata.name,
        {
          description: metadata.description,
          inputSchema: this.toRawShape(metadata.inputSchema),
        },
        async (args: Record<string, unknown>, extra) => {
          const result = await this.runWithInterceptors(
            {
              kind: McpExecutionKind.Tool,
              name: metadata.name,
              arguments: args,
              extra,
            },
            () => Promise.resolve(executor.execute(args, extra)),
          );

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          };
        },
      );
    }
  }

  /** registry 에 등록된 resource 들을 McpServer 에 등록한다. */
  private registerResources(server: McpServer) {
    for (const { metadata, handler } of this.registry.getResourceEntries()) {
      server.registerResource(
        metadata.name,
        new ResourceTemplate(metadata.uri, { list: undefined }),
        {
          description: metadata.description,
          mimeType: metadata.mimeType,
        },
        async (uri, variables, extra) => {
          const result = await this.runWithInterceptors(
            {
              kind: McpExecutionKind.Resource,
              name: uri.href,
              arguments: variables,
              extra,
            },
            () => Promise.resolve(handler(variables, extra)),
          );

          return {
            contents: [
              {
                uri: uri.href,
                mimeType: metadata.mimeType ?? 'application/json',
                text: JSON.stringify(result),
              },
            ],
          };
        },
      );
    }
  }

  /**
   * inputSchema(JSON Schema 골격 + Zod property) 를 McpServer 가 요구하는
   * Zod raw shape 로 변환한다. `required` 배열에 없는 property 는 `.optional()` 처리한다.
   */
  private toRawShape(inputSchema?: McpToolInputSchema): ZodRawShape {
    if (!inputSchema) {
      return {};
    }

    const required = new Set(inputSchema.required ?? []);
    const entries = Object.entries(inputSchema.properties).map(
      ([key, schema]) => [key, required.has(key) ? schema : schema.optional()],
    );

    return Object.fromEntries(entries) as ZodRawShape;
  }

  /**
   * 인터셉터를 양파(onion) 구조로 합성해 실행한다.
   * 배열 순서가 바깥→안쪽(먼저 등록한 인터셉터가 가장 먼저 실행)이며,
   * 미등록 시에는 handler 를 그대로 호출해 기존 동작과 동일하다.
   */
  private runWithInterceptors<T>(
    context: McpExecutionContext,
    handler: McpExecutionHandler<T>,
  ): Promise<T> {
    const interceptors = this.interceptors ?? [];
    if (interceptors.length === 0) {
      return handler();
    }

    const composed = interceptors.reduceRight<McpExecutionHandler<T>>(
      (next, interceptor) => () => interceptor.intercept(context, next),
      handler,
    );

    return composed();
  }
}
