import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage, JSONRPCMessageSchema, } from '@modelcontextprotocol/sdk/types.js';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * SSE/HTTP 어댑터 트랜스포트
 * GET /mcp/sse 로 SSE 스트림을 열고,
 * POST /mcp/message 로 메시지를 수신합니다.
 */
export class SseHttpTransport implements Transport {
  private _sessionId: string;
  private _res: Response | null = null;

  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(private readonly _endpoint: string) {
    this._sessionId = randomUUID();
  }

  get sessionId(): string {
    return this._sessionId;
  }

  /**
   * SSE 응답 객체를 주입하고 스트림을 시작합니다.
   * Controller의 GET /mcp/sse 핸들러에서 호출합니다.
   */
  attachResponse(res: Response): void {
    this._res = res;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    // 클라이언트에게 POST 엔드포인트와 sessionId 알려주기
    res.write(
      `event: endpoint\ndata: ${this._endpoint}?sessionId=${this._sessionId}\n\n`,
    );

    res.on('close', () => {
      this._res = null;
      this.onclose?.();
    });
  }

  async start(): Promise<void> {
    // attachResponse()에서 처리하므로 여기서는 아무것도 하지 않음
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._res) {
      throw new Error('SSE connection not established');
    }
    this._res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
  }

  async close(): Promise<void> {
    this._res?.end();
    this._res = null;
    this.onclose?.();
  }

  /**
   * HTTP POST 메시지를 처리합니다.
   * Controller의 POST /mcp/message 핸들러에서 호출합니다.
   */
  async handlePostMessage(req: Request, res: Response): Promise<void> {
    if (!this._res) {
      res.writeHead(500).end('SSE connection not established');
      return;
    }

    let body: unknown;
    try {
      body = req.body;
      if (!body || typeof body !== 'object') {
        throw new Error('Invalid body');
      }
    } catch (error) {
      res.writeHead(400).end(String(error));
      this.onerror?.(error as Error);
      return;
    }

    try {
      const message = JSONRPCMessageSchema.parse(body);
      this.onmessage?.(message);
    } catch (error) {
      res.writeHead(400).end(`Invalid message: ${JSON.stringify(body)}`);
      this.onerror?.(error as Error);
      return;
    }

    res.writeHead(202).end('Accepted');
  }
}
