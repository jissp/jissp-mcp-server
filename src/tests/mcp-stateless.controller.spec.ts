import { INestApplication, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { McpServerModule } from '../../lib/mcp-server/mcp-server.module';
import { McpStatelessController } from '../../lib/mcp-server/mcp-stateless.controller';
import { McpServerController } from '../../lib/mcp-server/mcp-server.controller';
import { McpSessionStore } from '../../lib/mcp-server/mcp-session.store';
import { McpServerService } from '../../lib/mcp-server/mcp-server.service';
import { McpResource, McpTool } from '../../lib/mcp-server/decorators';
import type { ExecutorExtra } from '../../lib/mcp-server/base.executor';

const echoProperties = { value: z.string().describe('돌려받을 값') };

/** 테스트용 executor. extra 를 그대로 노출해 stateless 에서의 값 변화를 검증한다. */
@Injectable()
class EchoExecutor {
  @McpTool({
    name: 'echo',
    description: '입력을 그대로 돌려준다',
    inputSchema: {
      type: 'object',
      properties: echoProperties,
      required: ['value'],
    },
  })
  @McpResource({
    uri: 'echo:///value/{value}',
    name: 'echo',
    mimeType: 'application/json',
  })
  public execute(args: { value: string }, extra: ExecutorExtra) {
    return { value: args.value, sessionId: extra.sessionId ?? null };
  }
}

@Module({
  imports: [McpServerModule.forFeature({ executors: [EchoExecutor] })],
})
class EchoDomainModule {}

async function createApp(
  options: Parameters<typeof McpServerModule.forRoot>[0],
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [McpServerModule.forRoot(options), EchoDomainModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return app;
}

function urlOf(app: INestApplication): URL {
  const httpServer = app.getHttpServer() as Server;
  const { port } = httpServer.address() as AddressInfo;

  return new URL(`http://127.0.0.1:${port}/mcp`);
}

interface EchoPayload {
  value: string;
  sessionId: string | null;
}

/** tool 응답 본문(JSON 문자열)을 타입이 있는 형태로 읽는다. */
function readEchoPayload(content: unknown): EchoPayload {
  const [first] = content as { text: string }[];

  return JSON.parse(first.text) as EchoPayload;
}

describe('McpServerModule.forRoot - 모드별 구성', () => {
  it('기본값은 stateful 이라 기존 컨트롤러와 세션 저장소를 등록한다', async () => {
    const app = await createApp({});

    expect(app.get(McpServerController)).toBeInstanceOf(McpServerController);
    expect(app.get(McpSessionStore)).toBeInstanceOf(McpSessionStore);

    await app.close();
  });

  it('stateless 모드에서는 세션 저장소를 등록하지 않는다', async () => {
    const app = await createApp({ mode: 'stateless' });

    expect(app.get(McpStatelessController)).toBeInstanceOf(
      McpStatelessController,
    );
    // 보관할 세션이 없으므로 스위퍼가 도는 저장소 자체가 존재하지 않아야 한다.
    expect(() => app.get(McpSessionStore)).toThrow();
    expect(() => app.get(McpServerController)).toThrow();

    await app.close();
  });
});

describe('stateless 모드 요청 처리', () => {
  let app: INestApplication;
  let client: Client;

  beforeAll(async () => {
    app = await createApp({ mode: 'stateless' });
    await app.listen(0);

    client = new Client({ name: 'stateless-spec', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(urlOf(app)));
  });

  afterAll(async () => {
    await client?.close();
    await app?.close();
  });

  it('세션 헤더 없이 initialize 후 tool 목록을 조회한다', async () => {
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toContain('echo');
  });

  it('tool 을 호출하면 결과를 돌려주고 sessionId 는 비어 있다', async () => {
    const result = await client.callTool({
      name: 'echo',
      arguments: { value: 'hello' },
    });
    const payload = readEchoPayload(result.content);

    expect(payload).toEqual({ value: 'hello', sessionId: null });
  });

  it('resource 템플릿을 조회한다', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();

    expect(resourceTemplates.map((it) => it.name)).toContain('echo');
  });

  it('요청을 반복해도 매번 새 서버로 처리한다', async () => {
    for (let index = 0; index < 20; index += 1) {
      const result = await client.callTool({
        name: 'echo',
        arguments: { value: `call-${index}` },
      });
      const payload = readEchoPayload(result.content);

      expect(payload.value).toBe(`call-${index}`);
    }
  });

  it('SSE 스트림(GET)과 세션 종료(DELETE)는 405 로 거절한다', async () => {
    const url = urlOf(app);

    const getResponse = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
    });
    const deleteResponse = await fetch(url, { method: 'DELETE' });

    expect(getResponse.status).toBe(405);
    expect(deleteResponse.status).toBe(405);
  });
});

describe('stateless 모드 리소스 정리', () => {
  /**
   * 이 전환에서 가장 실수하기 쉬운 지점의 회귀 테스트다.
   * 요청마다 McpServer 를 새로 만드는 구조라, 응답 후 닫지 않으면 요청 수에 비례해
   * heap 이 늘어난다(서버 1개당 약 628KB). 생성과 정리가 1:1 인지 확인한다.
   */
  it('요청마다 서버를 새로 만들고 응답이 끝나면 모두 닫는다', async () => {
    const app = await createApp({ mode: 'stateless' });
    await app.listen(0);

    const service = app.get(McpServerService);
    const createSpy = jest.spyOn(service, 'createConfiguredServer');
    const closeSpy = jest.spyOn(McpServer.prototype, 'close');

    const client = new Client({ name: 'cleanup-spec', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(urlOf(app)));

    const CALL_COUNT = 5;
    for (let index = 0; index < CALL_COUNT; index += 1) {
      await client.callTool({
        name: 'echo',
        arguments: { value: `v${index}` },
      });
    }
    await client.close();

    // res 의 close 이벤트는 응답 종료 직후 비동기로 발생하므로 잠시 양보한다.
    await new Promise((resolve) => setTimeout(resolve, 100));

    // initialize + notifications/initialized + tool 호출마다 1개씩 생성된다.
    expect(createSpy.mock.calls.length).toBeGreaterThanOrEqual(CALL_COUNT);
    // 생성 횟수와 정리 횟수가 일치해야 남는 서버가 없다.
    expect(closeSpy.mock.calls.length).toBe(createSpy.mock.calls.length);

    closeSpy.mockRestore();
    await app.close();
  });
});
