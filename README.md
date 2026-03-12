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
- **세션 관리**: 세션 ID 기반 요청 추적

## 빠른 시작

### 1. 모듈 설정

```typescript
import { Module } from '@nestjs/common';
import { McpServerModule } from '@lib/mcp-server';

@Module({
  imports: [
    McpServerModule.forRoot({
      executors: [
        // 커스텀 executor 등록
      ],
    }),
  ],
})
export class AppModule {}
```

### 2. 도구(Tool) 정의

```typescript
import { Injectable } from '@nestjs/common';
import { McpTool } from '@lib/mcp-server';

@Injectable()
export class CalculatorService {
  @McpTool({
    name: 'add',
    description: '두 숫자를 더합니다',
  })
  add(a: number, b: number): number {
    return a + b;
  }
}
```

### 3. 리소스(Resource) 정의

```typescript
import { McpResource } from '@lib/mcp-server';

@Injectable()
export class DataService {
  @McpResource({
    name: 'user-data',
    description: '사용자 데이터 리소스',
  })
  getUserData(userId: string): object {
    return { id: userId, name: 'John Doe' };
  }
}
```

## API 레퍼런스

### McpServerModule

동적 모듈로, NestJS 애플리케이션에 MCP 서버 기능을 추가합니다.

#### forRoot(options)

```typescript
McpServerModule.forRoot({
  executors: [
    { provide: 'EXECUTOR_NAME', useClass: CustomExecutor },
  ],
})
```

**옵션:**
- `executors`: Executor 프로바이더 배열

### 데코레이터

#### @McpTool(metadata)

메서드를 MCP 도구로 등록합니다.

```typescript
@McpTool({
  name: string;           // 도구 이름 (필수)
  description?: string;   // 도구 설명
})
```

#### @McpResource(metadata)

메서드를 MCP 리소스로 등록합니다.

```typescript
@McpResource({
  name: string;           // 리소스 이름 (필수)
  description?: string;   // 리소스 설명
})
```

### 타입 정의

#### McpServerConfig

```typescript
interface McpServerConfig {
  name: string;           // 서버 이름
  version: string;        // 서버 버전
  description?: string;   // 서버 설명
}
```

#### JsonRpcRequest

```typescript
interface JsonRpcRequest<T = any> {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params: T;
}
```

#### JsonRpcResult

```typescript
interface JsonRpcResult<T = unknown> {
  jsonrpc: '2.0';
  id?: number | string;
  result: T;
}
```

#### JsonRpcErrorResult

```typescript
interface JsonRpcErrorResult<T = unknown> {
  jsonrpc: '2.0';
  id?: number | string;
  error: T;
}
```

## 아키텍처

### 핵심 컴포넌트

```
McpServerModule
├── McpServerController      // HTTP 요청 처리
├── McpServerService         // 메인 서비스
├── McpMetadataRegistryService // 메타데이터 관리
└── MetadataScannerModule    // 메타데이터 스캔
```

### 요청 흐름

1. **클라이언트 요청** → JSON-RPC 형식
2. **McpServerController** → 요청 수신 및 세션 검증
3. **McpServerService** → 로직 처리
4. **MetadataScanner** → 메타데이터 조회
5. **Executor** → 실제 메서드 실행
6. **응답** → JSON-RPC 결과 반환

## 확장

### 커스텀 Executor 작성

```typescript
import { Injectable } from '@nestjs/common';
import { BaseExecutor } from '@lib/mcp-server';

@Injectable()
export class CustomExecutor extends BaseExecutor {
  execute(target: any, propertyKey: string, args: any[]) {
    // 커스텀 실행 로직
    return target[propertyKey](...args);
  }
}
```

## 라이센스

MIT

## 저자

your-name &lt;your-email@example.com&gt;
