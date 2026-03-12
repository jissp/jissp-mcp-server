# jissp-nestjs-mcp-server

NestJS 기반의 Model Context Protocol (MCP) 서버 라이브러리입니다. 데코레이터와 메타데이터 스캐닝을 통해 MCP 리소스와 도구를 간편하게 정의하고 관리할 수 있습니다.

## 설치

```bash
npm install jissp-nestjs-mcp-server
```

## 주요 기능

- **데코레이터 기반 정의**: `@McpTool`, `@McpResource` 데코레이터로 리소스와 도구 정의
- **자동 메타데이터 스캔**: 클래스와 메서드의 메타데이터 자동 수집
- **Executor 패턴**: 커스텀 executor를 통한 확장 가능한 아키텍처
- **JSON-RPC 통신**: 표준 JSON-RPC 2.0 프로토콜 지원
- **세션 관리**: 세션 ID 기반 요청 추적 (Header: `mcp-session-id`)

## 빠른 시작

### 1. 전역 모듈 설정

`AppModule`에서 `forRoot()`를 호출하여 MCP 서버의 핵심 인프라(Controller, Service 등)를 전역적으로 설정합니다.

```typescript
import { Module } from '@nestjs/common';
import { McpServerModule } from 'jissp-nestjs-mcp-server';

@Module({
  imports: [
    McpServerModule.forRoot(),
  ],
})
export class AppModule {}
```

### 2. 도구(Tool) 및 리소스(Resource) 등록

`forFeature()`를 사용하여 특정 도구나 리소스를 구현한 `executors`를 등록합니다.

```typescript
import { Module } from '@nestjs/common';
import { McpServerModule } from 'jissp-nestjs-mcp-server';
import { MyToolExecutor } from './my-tool.executor';
import { MyResourceService } from './my-resource.service';

@Module({
  imports: [
    McpServerModule.forFeature({
      executors: [MyToolExecutor, MyResourceService],
    }),
  ],
})
export class MyFeatureModule {}
```

### 3. 도구(Tool) 정의

도구는 `BaseExecutor` 인터페이스를 구현해야 하며, 실행 메서드에 `@McpTool` 데코레이터를 사용합니다.

```typescript
import { Injectable } from '@nestjs/common';
import { McpTool, BaseExecutor, JsonRpcCallRequest } from 'jissp-nestjs-mcp-server';

@Injectable()
export class MyToolExecutor implements BaseExecutor {
  @McpTool({
    name: 'calculate-sum',
    description: '두 숫자의 합을 계산합니다.',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    },
  })
  async execute(request: JsonRpcCallRequest) {
    const { a, b } = request.params.arguments as { a: number; b: number };
    return a + b;
  }
}
```

### 4. 리소스(Resource) 정의

리소스는 서비스 내의 메서드에 `@McpResource` 데코레이터를 사용하여 정의합니다. URI 템플릿을 지원합니다.

```typescript
import { Injectable } from '@nestjs/common';
import { McpResource } from 'jissp-nestjs-mcp-server';

@Injectable()
export class MyResourceService {
  @McpResource({
    uri: 'file://{path}',
    name: 'system-file',
    description: '시스템 파일을 읽어옵니다.',
    mimeType: 'text/plain',
  })
  async getFileContent(request: any) {
    const { path } = request.params.arguments;
    // 파일 읽기 로직...
    return `Content of ${path}`;
  }
}
```

## API 레퍼런스

### McpServerModule

#### `forRoot()`
MCP 서버의 핵심 기능(SSE 스트림, JSON-RPC 처리 등)을 전역 모듈로 등록합니다.

#### `forFeature(options: McpServerFeatureOptions)`
특정 도구(Tool)나 리소스(Resource)를 담당할 프로바이더를 등록합니다.
- `executors`: `BaseExecutor`를 구현하거나 MCP 데코레이터가 사용된 프로바이더 배열.
- `imports`: (선택) `executors`가 의존하는 다른 모듈들.

### 데코레이터

#### `@McpTool(options: McpToolOptions)`
메서드를 MCP 도구로 등록합니다. 해당 클래스는 `BaseExecutor`를 구현해야 합니다.
```typescript
{
  name: string;           // 도구 이름 (필수)
  description?: string;   // 도구 설명
  inputSchema?: any;      // JSON Schema 형식의 입력 파라미터 정의
}
```

#### `@McpResource(options: McpResourceOptions)`
메서드를 MCP 리소스로 등록합니다.
```typescript
{
  uri: string;            // 리소스 URI 템플릿 (필수, 예: 'myschema://{id}')
  name: string;           // 리소스 이름 (필수)
  description?: string;   // 리소스 설명
  mimeType?: string;      // 리소스의 MIME 타입
}
```

## 아키텍처

### 요청 흐름

1. **클라이언트 SSE 연결** → `GET /mcp` (Header에 `mcp-session-id` 포함 권장)
2. **JSON-RPC 요청** → `POST /mcp`
3. **McpServerController** → 요청 수신 및 세션 검증 (`McpSessionIdGuard`)
4. **McpServerService** → 메서드 핸들러 조회 및 `McpMetadataRegistryService` 참조
5. **Executor / Handler** → `@McpTool` 클래스의 `execute` 또는 `@McpResource` 메서드 실행
6. **응답** → JSON-RPC 결과 반환

## 라이센스

MIT
