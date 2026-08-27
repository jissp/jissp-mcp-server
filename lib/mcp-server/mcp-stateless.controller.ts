import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Inject,
  Logger,
  Optional,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { McpServerService } from './mcp-server.service';
import type { McpStatelessOptions } from './mcp-server.types';

/** McpStatelessController 가 주입받는 stateless 옵션 토큰 */
export const MCP_STATELESS_OPTIONS = Symbol('MCP_STATELESS_OPTIONS');

/**
 * stateless 모드 컨트롤러. (`McpServerModule.forRoot({ mode: 'stateless' })`)
 *
 * 세션을 일절 보관하지 않는다. 요청 하나마다 McpServer 와 트랜스포트를 새로 만들고
 * 응답이 끝나면 즉시 닫아 GC 대상으로 넘긴다. 보관하는 것이 없으므로 세션 누수가
 * 구조적으로 불가능하고, 로드밸런서 뒤에서 세션 어피니티도 필요 없다.
 *
 * 대가로 서버→클라이언트 방향 통신을 포기한다. 알림(SSE)·sampling·elicitation 이
 * 필요하면 stateful 모드를 써야 한다.
 */
@Controller('mcp')
export class McpStatelessController {
  private readonly logger = new Logger(McpStatelessController.name);

  constructor(
    private readonly mcpService: McpServerService,
    @Optional()
    @Inject(MCP_STATELESS_OPTIONS)
    private readonly options: McpStatelessOptions = {},
  ) {}

  /**
   * 클라이언트 → 서버 메시지 수신.
   *
   * 세션 조회가 없다. initialize 든 tools/call 이든 똑같이 새 서버로 처리한다.
   * 클라이언트는 평소처럼 initialize 를 보내지만 응답에 `mcp-session-id` 가 실리지
   * 않으므로, 이후 요청에도 세션 헤더를 붙이지 않는다.
   */
  @Post()
  async handlePost(@Req() req: Request, @Res() res: Response) {
    const server = this.mcpService.createConfiguredServer();
    // stateless 트랜스포트는 재사용이 금지되어 있다. 재사용하면 SDK 가 예외를 던진다.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: this.options.enableJsonResponse,
    });

    // 응답이 끝나면 반드시 닫는다. 이 정리를 빠뜨리면 요청마다 McpServer 가 남아
    // stateful 시절보다 빠르게 heap 이 늘어난다.
    res.on('close', () => {
      void this.dispose(transport, server);
    });

    await server.connect(transport);
    // NestJS(body-parser)가 본문을 이미 파싱했으므로 parsedBody 로 전달합니다.
    await transport.handleRequest(req, res, req.body);
  }

  /**
   * 서버 → 클라이언트 SSE 스트림은 stateless 에서 성립하지 않는다.
   * 스트림을 유지할 세션이 없으므로 405 로 명시적으로 거절한다.
   */
  @Get()
  handleGet(@Res() res: Response) {
    this.rejectSessionMethod(res);
  }

  /**
   * 종료할 세션 자체가 없으므로 DELETE 도 거절한다.
   */
  @Delete()
  handleDelete(@Res() res: Response) {
    this.rejectSessionMethod(res);
  }

  private rejectSessionMethod(res: Response) {
    res.status(HttpStatus.METHOD_NOT_ALLOWED).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method Not Allowed: server is running in stateless mode',
      },
      id: null,
    });
  }

  /**
   * 요청 하나에 쓰인 트랜스포트와 서버를 닫는다.
   * 정리 실패가 응답에 영향을 주면 안 되므로 예외는 로그만 남기고 삼킨다.
   */
  private async dispose(
    transport: StreamableHTTPServerTransport,
    server: { close: () => Promise<void> },
  ) {
    const results = await Promise.allSettled([
      transport.close(),
      server.close(),
    ]);

    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(
          `요청 종료 후 정리에 실패했습니다: ${String(result.reason)}`,
        );
      }
    }
  }
}
