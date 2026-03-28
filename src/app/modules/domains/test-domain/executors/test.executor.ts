import { Injectable } from '@nestjs/common';
import { McpResource, McpSchemaProperty, McpTool } from '../../../../../../lib';

export class GetStockExecutorParams {
  @McpSchemaProperty({
    type: 'string',
    description: 'Stock code (e.g., 005930)',
    isRequired: true,
  })
  stockCode: string;

  @McpSchemaProperty({
    type: 'string',
    description: 'Stock Name(e.g., 삼성전자)',
    isRequired: false,
  })
  name: string;
}

@Injectable()
export class TestExecutor {
  constructor() {}

  @McpTool({
    name: 'test-execute',
    description: 'Test',
    inputSchema: GetStockExecutorParams,
  })
  @McpResource({
    uri: 'stock:///code/{stockCode}',
    name: 'test-execute',
    description: 'Test',
    mimeType: 'application/json',
  })
  public execute(params: GetStockExecutorParams) {
    console.log(params);
  }
}
