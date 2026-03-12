import { Module } from '@nestjs/common';
import { McpServerModule } from '@lib/mcp-server';

@Module({
  imports: [
    McpServerModule.forRoot({
      executors: [],
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
