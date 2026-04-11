# nestjs-mcp-server

> **참고**: 이 프로젝트는 NestJS 환경에서 Model Context Protocol (MCP) 서버를 간편하게 구축하기 위한 라이브러리입니다.

NestJS의 강력한 데코레이터와 메타데이터 스캐닝 기능을 활용하여 MCP 리소스(Resource)와 도구(Tool)를 정의하고 관리할 수 있습니다. 

최신 버전은 공식 `@modelcontextprotocol/sdk`를 기반으로 하며, **SSE(Server-Sent Events)** 전송 방식을 지원합니다.

## 설치

```bash
npm install @jissp/nestjs-mcp-server
```

## 주요 기능

- **공식 MCP SDK 기반**: `@modelcontextprotocol/sdk`를 사용하여 표준 규격 완벽 준수
- **SSE 전송 방식**: 실시간 양방향 통신을 위한 SSE(Server-Sent Events) 지원
- **데코레이터 기반 정의**: `@McpTool`, `@McpResource`, `@McpSchemaProperty`를 이용한 간결한 정의
- **자동 메타데이터 스캔**: 클래스와 메서드에 정의된 MCP 메타데이터 자동 수집 및 등록
- **Executor 패턴**: 비즈니스 로직을 분리하여 확장 가능한 구조 제공

## 빠른 시작

### 1. 전역 모듈 설정

`AppModule`에서 `McpServerModule.forRoot()`를 호출하여 MCP 서버 인프라를 설정합니다.

```typescript
import { Module } from '@nestjs/common';
import { McpServerModule } from '@jissp/nestjs-mcp-server';

@Module({
  imports: [
    McpServerModule.forRoot(),
  ],
})
export class AppModule {}
```

### 2. 도구(Tool) 및 리소스(Resource) 등록

`forFeature()`를 사용하여 MCP 요소들을 구현한 프로바이더를 등록합니다.

```typescript
@Module({
  imports: [
    McpServerModule.forFeature({
      executors: [MyToolExecutor, MyResourceService],
    }),
  ],
})
export class MyFeatureModule {}
```

### 3. 클라이언트 설정 (예: Claude Desktop)

클라이언트(예: Claude Desktop)에서 이 서버를 사용하려면 다음과 같이 SSE 방식으로 설정해야 합니다.

**`config.json` 예시:**

```json
{
  "mcpServers": {
    "my-nestjs-server": {
      "command": "node",
      "args": ["/path/to/your/server/dist/main.js"],
      "env": {
        "MCP_TRANSPORT": "sse",
        "MCP_ENDPOINT": "http://localhost:3000/mcp/sse"
      }
    }
  }
}
```

*참고: 서버 주소는 기본적으로 `http://localhost:3000/mcp/sse`가 엔드포인트가 됩니다.*

## 정의 가이드

### 도구(Tool) 정의

`BaseExecutor` 인터페이스를 구현하고 `@McpTool` 데코레이터를 사용합니다.

```typescript
@Injectable()
export class CalculateSumExecutor implements BaseExecutor {
  @McpTool({
    name: 'calculate-sum',
    description: '두 숫자의 합을 구합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    },
  })
  async execute(request: JsonRpcToolRequest) {
    const { a, b } = request.params.arguments;
    return { result: a + b };
  }
}
```

### 리소스(Resource) 정의

메서드에 `@McpResource` 데코레이터를 사용하며, URI 템플릿(`{param}`)을 지원합니다.

```typescript
@Injectable()
export class MyResourceService {
  @McpResource({
    uri: 'docs://{topic}',
    name: 'documentation',
    description: '주제별 문서를 제공합니다.',
    mimeType: 'text/markdown',
  })
  async getDoc(request: any) {
    const { topic } = request.params.arguments;
    return `Content for ${topic}...`;
  }
}
```

## 아키텍처 및 요청 흐름

1.  **SSE 연결**: 클라이언트가 `GET /mcp/sse`에 접속하여 서버와 연결을 수립합니다.
2.  **엔드포인트 통지**: 서버는 연결 성공 시 클라이언트에게 메시지를 보낼 POST 엔드포인트(` /mcp/message?sessionId=...`)를 알립니다.
3.  **메시지 전송**: 클라이언트가 도구 실행 등을 요청할 때 해당 POST 엔드포인트로 JSON-RPC 메시지를 보냅니다.
4.  **핸들러 실행**: `McpServerService`가 SDK를 통해 요청을 해석하고, `McpMetadataRegistryService`에 등록된 핸들러를 찾아 실행합니다.
5.  **응답 반환**: 실행 결과가 SSE 스트림을 통해 다시 클라이언트에게 전달됩니다.
