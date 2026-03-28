import { Module } from '@nestjs/common';
import { McpServerModule } from '../../lib';
import { TestDomainModule } from './modules/domains/test-domain';

@Module({
  imports: [McpServerModule.forRoot(), TestDomainModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
