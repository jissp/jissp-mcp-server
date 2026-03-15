import { ModuleMetadata, Provider } from '@nestjs/common';
import { BaseExecutor } from './base.executor';

export interface McpServerConfig {
  name: string;
  version: string;
  description?: string;
}

export interface McpServerFeatureOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  executors: Provider<BaseExecutor>[];
}

export interface CommonJsonRpc {
  jsonrpc: '2.0';
  id?: number | string;
}

export interface JsonRpcRequest<T = any> extends CommonJsonRpc {
  method: string;
  params: T;
}

export type JsonRpcToolRequest<T = unknown> = JsonRpcRequest<{
  name: string;
  arguments: T;
}>;

export interface JsonRpcResourceParams {
  uri: string;
}

export interface JsonRpcResult<T = unknown> extends CommonJsonRpc {
  result: T;
}

export interface JsonRpcErrorResult<T = unknown> extends CommonJsonRpc {
  error: T;
}
