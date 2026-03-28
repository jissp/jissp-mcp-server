import { Module } from '@nestjs/common';
import { McpServerModule } from '../../../../../lib';
import { TestExecutor } from './executors/test.executor';

@Module({
  imports: [
    McpServerModule.forFeature({
      executors: [TestExecutor],
    }),
  ],
})
export class TestDomainModule {}
