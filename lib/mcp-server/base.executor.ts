import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { JsonRpcToolRequest } from './mcp-server.types';

export type ExecutorExtra = RequestHandlerExtra<
  ServerRequest,
  ServerNotification
>;

export interface BaseExecutor<T = unknown> {
  execute: (
    request: JsonRpcToolRequest,
    extra: ExecutorExtra,
  ) => T | Promise<T>;
}
