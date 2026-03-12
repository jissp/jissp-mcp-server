import { Request } from 'express';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JsonRpcRequest } from '../mcp-server.types';

@Injectable()
export class McpSessionIdGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = request.body as JsonRpcRequest;

    // initialize 메서드는 Session ID 검증 제외
    if (body.method === 'initialize') {
      return true;
    }

    const sessionId = request.headers['mcp-session-id'];
    if (!sessionId) {
      throw new BadRequestException('Missing MCP-Session-Id header');
    }

    return true;
  }
}
