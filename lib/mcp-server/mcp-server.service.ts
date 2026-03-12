import { Injectable } from '@nestjs/common';
import {
  JsonRpcCallRequest,
  JsonRpcErrorResult,
  JsonRpcRequest,
  JsonRpcResult,
} from './mcp-server.types';
import { McpMetadataRegistryService } from './mcp-metadata-registry.service';

type HandlerResult<T = unknown> = {
  result: JsonRpcResult<T> | JsonRpcErrorResult;
} | null;

@Injectable()
export class McpServerService {
  private readonly methodHandlers = new Map<
    string,
    (message: JsonRpcRequest) => Promise<HandlerResult>
  >([
    ['initialize', this.initialize.bind(this)],
    ['tools/list', this.toolsList.bind(this)],
    ['tools/call', this.toolCall.bind(this)],
    ['resources/list', this.resourceList.bind(this)],
    ['resources/read', this.resourceRead.bind(this)],
  ]);

  constructor(private readonly registry: McpMetadataRegistryService) {}

  public async handleMessage(message: JsonRpcRequest): Promise<HandlerResult> {
    const { method, id } = message;

    try {
      const methodHandler = this.methodHandlers.get(method);
      if (!methodHandler) {
        return null;
      }

      return methodHandler(message);
    } catch (error) {
      return {
        result: {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: error.message,
          },
        },
      };
    }
  }

  /**
   * @param id
   * @private
   */
  private initialize({ id }: JsonRpcRequest) {
    return this.wrapResult(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
      },
      serverInfo: {
        name: 'nestjs-mcp-server',
        version: '1.0.0',
      },
    });
  }

  /**
   * @param id
   * @private
   */
  private toolsList({ id }: JsonRpcRequest): HandlerResult {
    return this.wrapResult(id, {
      tools: this.registry.getTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema || { type: 'object' },
      })),
    });
  }

  /**
   * @param message
   * @private
   */
  private async toolCall(message: JsonRpcCallRequest): Promise<HandlerResult> {
    const { id, params } = message;
    const executor = this.registry.getToolExecutor(params.name);
    if (!executor) {
      throw new Error(`Tool not found: ${params.name}`);
    }

    // Executor의 execute 메서드 호출
    const executionResult = await executor.execute(message);

    return this.wrapResult(id, {
      content: [
        {
          type: 'text',
          text: JSON.stringify(executionResult),
        },
      ],
      isError: false,
    });
  }

  /**
   * @param id
   * @private
   */
  private resourceList({ id }: JsonRpcRequest): HandlerResult {
    return this.wrapResult(id, {
      resources: this.registry.getResources(),
    });
  }

  /**
   * @param message
   * @private
   */
  private async resourceRead(message: JsonRpcRequest): Promise<HandlerResult> {
    const { id, params } = message;
    const uri = params.uri;
    const matchResult = this.registry.getResourceHandler(uri);

    if (!matchResult) {
      throw new Error(`Resource not found: ${uri}`);
    }

    const { handler, params: uriParams } = matchResult;

    // 리소스 URI에서 추출한 파라미터를 Executor가 이해할 수 있는 arguments 형식으로 변환
    const transformedRequest = {
      ...message,
      params: {
        arguments: uriParams,
      },
    };

    const executionResult = await (handler as any)(transformedRequest);

    return this.wrapResult(id, {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(executionResult),
        },
      ],
    });
  }

  /**
   * @param id
   * @param result
   * @private
   */
  private wrapResult<T = unknown>(
    id: JsonRpcRequest['id'],
    result: T,
  ): HandlerResult<T> {
    return {
      result: {
        jsonrpc: '2.0',
        id,
        result,
      },
    };
  }
}
