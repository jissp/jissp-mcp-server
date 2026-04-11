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

export interface JsonRpcRequest<T = any> {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params: T;
}

export type JsonRpcToolRequest<T = unknown> = JsonRpcRequest<{
  name: string;
  arguments: T;
}>;
