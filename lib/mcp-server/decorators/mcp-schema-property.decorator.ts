import {
  ConstructorType,
  createPropertyDecorator,
} from '@jissp/metadata-scanner';
import { InputSchemaProperty } from './mcp-tool.decorator';

export const MCP_SCHEMA_PROPERTIES_METADATA = 'MCP_SCHEMA_PROPERTIES_METADATA';

export interface McpSchemaPropertyOptions {
  type: string;
  description: string;
  isRequired: boolean;
  enum?: (string | number)[];
  /**
   * type: 'array' 일 때 각 요소의 스키마.
   * - ConstructorType: 해당 클래스의 @McpSchemaProperty 메타데이터로 object 스키마 생성
   * - InputSchemaProperty: 인라인 스키마
   */
  items?: ConstructorType | InputSchemaProperty;
  /**
   * type: 'object' 일 때 중첩 프로퍼티를 정의하는 DTO 클래스.
   */
  properties?: ConstructorType;
}

export const McpSchemaProperty =
  createPropertyDecorator<McpSchemaPropertyOptions>(
    MCP_SCHEMA_PROPERTIES_METADATA,
  );
