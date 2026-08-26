import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  ReadResourceTemplateCallback,
  ToolCallback,
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

/**
 * McpServer 에 tool 하나를 등록하는 데 필요한 재료를 미리 만들어 둔 것.
 * 세션 상태를 참조하지 않으므로 모든 세션이 같은 객체를 공유해도 안전하다.
 */
interface PreparedTool {
  name: string;
  config: {
    description?: string;
    inputSchema: ZodRawShape;
  };
  handler: ToolCallback<ZodRawShape>;
}

/**
 * McpServer 에 resource 하나를 등록하는 데 필요한 재료를 미리 만들어 둔 것.
 * ResourceTemplate 은 URI 템플릿 파싱 결과만 보유하는 무상태 객체라 공유해도 안전하다.
 */
interface PreparedResource {
  name: string;
  template: ResourceTemplate;
  config: {
    description?: string;
    mimeType?: string;
  };
  handler: ReadResourceTemplateCallback;
}

@Injectable()
export class McpServerService {
  /**
   * 세션 간 공유되는 등록 서술자 캐시.
   * 세션마다 재생성하면 Zod 스키마·ResourceTemplate·핸들러 클로저가 세션 수에 비례해
   * 쌓이므로, 최초 1회만 만들어 모든 McpServer 인스턴스가 재사용한다.
   */
  private preparedTools?: PreparedTool[];
  private preparedResources?: PreparedResource[];

  constructor(
    private readonly registry: McpMetadataRegistryService,
    @Optional()
    @Inject(MCP_EXECUTION_INTERCEPTORS)
    private readonly interceptors: McpExecutionInterceptor[] = [],
  ) {}

  /**
   * 세션(트랜스포트) 하나에 연결할 McpServer 를 만든다.
   * SDK 가 서버:트랜스포트를 1:1 로 강제하므로 인스턴스 자체는 세션마다 필요하지만,
   * 등록 재료는 캐시된 것을 그대로 넘겨 세션당 비용을 최소화한다.
   */
  public createConfiguredServer(): McpServer {
    const server = new McpServer(
      { name: 'nestjs-mcp-server', version: '1.0.0' },
      { capabilities: { tools: {}, resources: {} } },
    );

    for (const { name, config, handler } of this.getPreparedTools()) {
      server.registerTool(name, config, handler);
    }

    for (const {
      name,
      template,
      config,
      handler,
    } of this.getPreparedResources()) {
      server.registerResource(name, template, config, handler);
    }

    return server;
  }

  /** registry 스캔(onModuleInit) 이 끝난 뒤 첫 세션에서 한 번만 변환한다. */
  private getPreparedTools(): PreparedTool[] {
    this.preparedTools ??= this.prepareTools();

    return this.preparedTools;
  }

  private getPreparedResources(): PreparedResource[] {
    this.preparedResources ??= this.prepareResources();

    return this.preparedResources;
  }

  /** registry 에 등록된 tool 들을 McpServer 등록 형태로 변환한다. 각 실행은 인터셉터 체인으로 감싼다. */
  private prepareTools(): PreparedTool[] {
    return this.registry.getToolEntries().map(({ metadata, executor }) => ({
      name: metadata.name,
      config: {
        description: metadata.description,
        inputSchema: this.toRawShape(metadata.inputSchema),
      },
      handler: async (args: Record<string, unknown>, extra) => {
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
    }));
  }

  /** registry 에 등록된 resource 들을 McpServer 등록 형태로 변환한다. */
  private prepareResources(): PreparedResource[] {
    return this.registry
      .getResourceEntries()
      .map(({ metadata, handler: resourceHandler }) => ({
        name: metadata.name,
        template: new ResourceTemplate(metadata.uri, { list: undefined }),
        config: {
          description: metadata.description,
          mimeType: metadata.mimeType,
        },
        handler: async (uri, variables, extra) => {
          const result = await this.runWithInterceptors(
            {
              kind: McpExecutionKind.Resource,
              name: uri.href,
              arguments: variables,
              extra,
            },
            () => Promise.resolve(resourceHandler(variables, extra)),
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
      }));
  }

  /**
   * inputSchema(JSON Schema 골격 + Zod property) 를 McpServer 가 요구하는
   * Zod raw shape 로 변환한다. `required` 배열에 없는 property 는 `.optional()` 처리한다.
   */
  private toRawShape(inputSchema?: McpToolInputSchema): ZodRawShape {
    if (!inputSchema) {
      return {};
    }

    const requiredKeys = new Set(inputSchema.required ?? []);
    const entries = Object.entries(inputSchema.properties).map(
      ([key, schema]) => [
        key,
        requiredKeys.has(key) ? schema : schema.optional(),
      ],
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
