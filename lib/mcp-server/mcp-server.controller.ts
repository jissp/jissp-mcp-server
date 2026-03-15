import {
  Body,
  Controller,
  Get,
  HttpStatus,
  MessageEvent,
  Post,
  Req,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, Subject } from 'rxjs';
import { McpSessionIdGuard } from './guards';
import type { JsonRpcRequest } from './mcp-server.types';
import { McpServerService } from './mcp-server.service';

@Controller('mcp')
export class McpServerController {
  private eventSubject = new Subject<MessageEvent>();

  constructor(private readonly mcpService: McpServerService) {}

  /**
   * GET 요청은 SSE 스트림을 엽니다.
   */
  @Sse()
  @Get()
  sse(@Req() req: Request): Observable<MessageEvent> {
    const sessionId = req.headers['mcp-session-id'];
    console.log(
      `SSE Connected with Session ID: ${sessionId?.toString() ?? 'unknown'}`,
    );

    return this.eventSubject.asObservable();
  }

  /**
   * POST 요청은 JSON-RPC 메시지를 받습니다.
   */
  @UseGuards(McpSessionIdGuard)
  @Post()
  async handleIncomingMessage(
    @Body() body: JsonRpcRequest,
    @Res() res: Response,
  ) {
    const response = await this.mcpService.handleMessage(body);
    if (!response) {
      return res.status(HttpStatus.ACCEPTED).send();
    }

    if (body.method === 'initialize') {
      res.setHeader('MCP-Session-Id', crypto.randomUUID());
    }

    return res.status(HttpStatus.OK).json(response.result);
  }

  // (옵션) 서버에서 클라이언트로 알림을 보낼 때 사용하는 내부 메서드
  // sendNotification(method: string, params: any) {
  //     this.eventSubject.next({
  //         data: { jsonrpc: '2.0', method, params },
  //     } as MessageEvent);
  // }
}
