import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { McpServerService } from './mcp-server.service';

@Controller('mcp')
export class McpServerController {
  /** sessionId 별 트랜스포트 */
  private readonly transports = new Map<
    string,
    StreamableHTTPServerTransport
  >();

  constructor(private readonly mcpService: McpServerService) {}

  /**
   * 클라이언트 → 서버 메시지 수신.
   * - 기존 세션: `mcp-session-id` 헤더로 트랜스포트 조회
   * - 신규 세션: initialize 요청이면 트랜스포트를 생성하고 서버에 연결
   */
  @Post()
  async handlePost(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    let transport: StreamableHTTPServerTransport | undefined;

    if (sessionId && this.transports.has(sessionId)) {
      // 기존 세션
      transport = this.transports.get(sessionId);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // 신규 세션 초기화
      transport = await this.createTransport();
    } else if (sessionId) {
      // 알 수 없는(만료된) 세션 → 404 로 응답해 클라이언트가 재초기화하도록 유도합니다.
      res.status(HttpStatus.NOT_FOUND).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found' },
        id: null,
      });
      return;
    } else {
      // 세션 ID 도 없고 initialize 요청도 아님
      res.status(HttpStatus.BAD_REQUEST).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // NestJS(body-parser)가 본문을 이미 파싱했으므로 parsedBody 로 전달합니다.
    await transport!.handleRequest(req, res, req.body);
  }

  /**
   * 서버 → 클라이언트 SSE 스트림 (알림 수신용).
   */
  @Get()
  async handleGet(@Req() req: Request, @Res() res: Response) {
    await this.handleSessionRequest(req, res);
  }

  /**
   * 세션 종료.
   */
  @Delete()
  async handleDelete(@Req() req: Request, @Res() res: Response) {
    await this.handleSessionRequest(req, res);
  }

  /**
   * 기존 세션에 대한 GET/DELETE 요청을 트랜스포트로 위임합니다.
   */
  private async handleSessionRequest(req: Request, res: Response) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId) {
      res.status(HttpStatus.BAD_REQUEST).send('Missing session ID');
      return;
    }

    const transport = this.transports.get(sessionId);
    if (!transport) {
      // 알 수 없는(만료된) 세션 → 404 로 재초기화 유도
      res.status(HttpStatus.NOT_FOUND).send('Session not found');
      return;
    }

    await transport.handleRequest(req, res);
  }

  /**
   * Streamable HTTP 트랜스포트를 생성하고 MCP 서버에 연결합니다.
   * 세션이 초기화되면 transports 맵에 등록하고, 종료 시 제거합니다.
   */
  private async createTransport(): Promise<StreamableHTTPServerTransport> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        this.transports.set(sessionId, transport);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        this.transports.delete(transport.sessionId);
      }
    };

    const server = this.mcpService.createConfiguredServer();
    await server.connect(transport);

    return transport;
  }
}
