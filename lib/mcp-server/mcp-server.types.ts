import { BaseExecutor } from './base.executor';
import { Provider } from '@nestjs/common';

export enum McpServerProvider {
  MCP_SERVER_CONFIG = 'MCP_SERVER_CONFIG',
}

export interface McpServerModuleOptions {
  executors: Provider<BaseExecutor>[];
}

export interface McpServerConfig {
  name: string;
  version: string;
  description?: string;
}

export interface CommonJsonRpc {
  jsonrpc: '2.0';
  id?: number | string;
}

export interface JsonRpcRequest<T = any> extends CommonJsonRpc {
  method: string;
  params: T;
}

export type JsonRpcCallRequest<T = unknown> = JsonRpcRequest<{
  name: string;
  arguments: T;
}>;

export interface JsonRpcResult<T = unknown> extends CommonJsonRpc {
  result: T;
}

export interface JsonRpcErrorResult<T = unknown> extends CommonJsonRpc {
  error: T;
}
