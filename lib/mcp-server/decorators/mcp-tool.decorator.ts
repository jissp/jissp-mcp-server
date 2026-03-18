import { Reflector } from '@nestjs/core';

type ConstructorType = new (...args: any[]) => any;

export interface McpToolOptions {
  name: string;
  description?: string;
  inputSchema?: JsonSchema | ConstructorType;
}

export interface JsonSchema {
  type: 'object';
  properties: InputSchemaProperties;
  required?: string[];
}

export interface InputSchemaProperty {
  type: string;
  description?: string;
}
export type InputSchemaProperties = Record<string, InputSchemaProperty>;

export const McpTool = Reflector.createDecorator<McpToolOptions>();
