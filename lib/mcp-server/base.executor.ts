import { JsonRpcCallRequest } from './mcp-server.types';

export interface BaseExecutor<T = unknown> {
  execute: (request: JsonRpcCallRequest) => T | Promise<T>;
}
