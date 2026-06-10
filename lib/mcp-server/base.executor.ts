import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type {
  ServerNotification,
  ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';

export type ExecutorExtra = RequestHandlerExtra<
  ServerRequest,
  ServerNotification
>;

export interface BaseExecutor<TArgs = unknown, TResult = unknown> {
  execute: (args: TArgs, extra: ExecutorExtra) => TResult | Promise<TResult>;
}
