import { JsonRpcToolRequest } from './mcp-server.types';

export interface BaseExecutor<T = unknown> {
  execute: (request: JsonRpcToolRequest) => T | Promise<T>;
}
