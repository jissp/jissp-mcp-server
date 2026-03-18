import { Reflector } from '@nestjs/core';

export interface McpResourceOptions {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export const McpResource = Reflector.createDecorator<McpResourceOptions>();
