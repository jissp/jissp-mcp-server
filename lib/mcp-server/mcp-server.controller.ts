import { Controller, Get, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpServerService } from './mcp-server.service';
import { SseHttpTransport } from './transports/sse-http-transport';

@Controller('mcp')
export class McpServerController {
  private readonly transportMap = new Map<string, SseHttpTransport>();

  constructor(private readonly mcpService: McpServerService) {}

  @Get('sse')
  async sse(@Req() req: Request, @Res() res: Response) {
    const transport = new SseHttpTransport('/mcp/message');
    const server = this.mcpService.createConfiguredServer();

    transport.onclose = () => {
      this.transportMap.delete(transport.sessionId);
    };

    transport.attachResponse(res);
    await server.connect(transport);
    this.transportMap.set(transport.sessionId, transport);

    req.on('close', () => transport.close());
  }

  @Post('message')
  async handleMessage(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.query['sessionId'] as string;
    const transport = this.transportMap.get(sessionId);

    if (!transport) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ error: 'Session not found' });
    }

    await transport.handlePostMessage(req, res);
  }
}
