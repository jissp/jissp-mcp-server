import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { McpResource, McpTool } from '../../../../../../lib';

const getStockProperties = {
  stockCode: z
    .enum(['005930', '000660', '035420'])
    .describe('Stock code (e.g., 005930)'),
  name: z.string().describe('Stock Name (e.g., 삼성전자)'),
};

type GetStockArgs = z.infer<z.ZodObject<typeof getStockProperties>>;

@Injectable()
export class TestExecutor {
  @McpTool({
    name: 'test-execute',
    description: 'Test',
    inputSchema: {
      type: 'object',
      properties: getStockProperties,
      required: ['stockCode'],
    },
  })
  @McpResource({
    uri: 'stock:///code/{stockCode}',
    name: 'test-execute',
    description: 'Test',
    mimeType: 'application/json',
  })
  public execute(args: GetStockArgs) {
    console.log(args);
    return args;
  }
}
