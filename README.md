# nestjs-mcp-server

> **참고**: 이 프로젝트는 NestJS 환경에서 Model Context Protocol (MCP) 서버를 간편하게 구축하기 위한 라이브러리입니다.

NestJS의 데코레이터와 메타데이터 스캐닝을 활용해 MCP 리소스(Resource)와 도구(Tool)를 정의하고 관리합니다.

공식 `@modelcontextprotocol/sdk` 의 `McpServer` 와 **Streamable HTTP** 전송 방식을 기반으로 하며,
도구 입력은 **Zod 스키마로 자동 검증**된 뒤 executor 로 전달됩니다.

## 설치

```bash
npm install @jissp/nestjs-mcp-server
```

## 주요 기능

- **공식 MCP SDK 기반**: `@modelcontextprotocol/sdk` 의 `McpServer` 를 사용해 표준 규격을 준수합니다.
- **Streamable HTTP 전송**: 단일 `/mcp` 엔드포인트에서 `POST`/`GET`/`DELETE` 를 처리합니다.
- **데코레이터 기반 정의**: `@McpTool`, `@McpResource` 로 도구·리소스를 선언합니다.
- **Zod 입력 검증**: 도구 인자를 SDK 가 검증한 뒤 타입이 보장된 값으로 넘겨줍니다.
- **자동 메타데이터 스캔**: 등록된 프로바이더의 MCP 메타데이터를 자동 수집·등록합니다.
- **실행 인터셉터**: 인증·로깅·메트릭 등 횡단 관심사를 도구/리소스 실행에 공통 적용합니다.
- **stateful / stateless 동작 모드**: 세션 유지 여부를 선택할 수 있습니다.

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

`forRoot()` 옵션은 다음과 같습니다. 모두 선택 사항이며, 아무것도 넘기지 않으면 stateful 기본값으로 동작합니다.

| 옵션 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `mode` | `'stateful' \| 'stateless'` | `'stateful'` | 세션 처리 방식 |
| `interceptors` | `Type<McpExecutionInterceptor>[]` | `[]` | 실행 인터셉터 (배열 순서 = 바깥→안쪽) |
| `session` | `McpSessionOptions` | `{}` | 세션 정리 정책 (stateful 전용) |
| `stateless` | `McpStatelessOptions` | `{}` | stateless 전용 설정 |
| `imports` | `ModuleMetadata['imports']` | `[]` | 인터셉터 등이 의존하는 모듈 |

#### 동작 모드 (stateful / stateless)

`mode` 옵션으로 세션 처리 방식을 고를 수 있습니다. **기본값은 `'stateful'`이며 기존 동작과
100% 동일**하므로, 이 옵션을 지정하지 않으면 아무것도 달라지지 않습니다.

```typescript
McpServerModule.forRoot({
  mode: 'stateless', // 기본값은 'stateful'
});
```

| | `stateful` (기본값) | `stateless` |
| --- | --- | --- |
| 세션 보관 | `mcp-session-id`별로 `McpServer`를 메모리에 보관 | 보관하지 않음 |
| `McpServer` 생성 | 세션당 1개 | **요청당 1개** (응답 후 즉시 폐기) |
| 세션 누수 | idle TTL 정리로 완화 | **구조적으로 발생 불가** |
| 로드밸런서 | 세션 어피니티 필요 | **불필요, 수평 확장 자유** |
| 프로세스 재시작 | 살아있던 세션이 끊김 | 끊길 세션이 없음 |
| `GET`(SSE) / `DELETE` | 지원 | `405` 반환 |
| 서버→클라이언트 알림 | 지원 | **불가** |
| sampling / elicitation | 지원 | **불가** |
| `extra.sessionId` | 세션 ID | 항상 `undefined` |

`stateless`에서 요청당 추가되는 비용은 tool 123개 + resource 123개 기준
**약 0.45ms / 628KB**이며, 응답이 끝나는 즉시 GC 대상이 됩니다.

##### stateless 전환 전 확인할 것

executor나 인터셉터에서 아래를 쓰고 있다면 `stateless`로 전환할 수 없습니다.
서버→클라이언트 방향 통신은 유지되는 세션을 전제로 하기 때문입니다.

```bash
grep -rnE "extra\.(sendNotification|sendRequest|sessionId|closeSSEStream|closeStandaloneSSEStream)" src/
```

| 검색 결과 | 판단 |
| --- | --- |
| 0건 | 전환 가능 |
| `sessionId`만 사용 | 전환 가능. `extra.requestId`나 인터셉터에서 발급하는 요청 단위 ID로 대체하세요. |
| `sendNotification` / `sendRequest` 사용 | 전환 불가. `stateful`을 유지하세요. |

`extra`의 나머지 멤버(`signal`, `authInfo`, `requestId`, `_meta`, `requestInfo`)는
`stateless`에서도 그대로 동작합니다.

##### stateless 전용 옵션

```typescript
McpServerModule.forRoot({
  mode: 'stateless',
  stateless: {
    enableJsonResponse: true, // 기본 false
  },
});
```

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `enableJsonResponse` | `false` | SSE 스트림 대신 단일 JSON으로 응답합니다. stateless는 요청과 응답이 1:1이라 스트림이 필요 없고, CloudFront 같은 중간 프록시의 SSE 버퍼링 문제를 피할 수 있습니다. |

MCP 클라이언트는 `stateless`에서도 설정을 바꿀 필요가 없습니다. 평소처럼 `initialize`를
보내고, 응답에 `mcp-session-id`가 실리지 않으면 이후 요청에도 세션 헤더를 붙이지 않습니다.

#### 세션 정리 옵션

> `mode: 'stateful'`(기본값)에서만 적용됩니다. `stateless`는 보관하는 세션이 없어
> 이 설정이 무시되며, 세션 저장소와 정리 스케줄러 자체가 생성되지 않습니다.

MCP 세션은 클라이언트가 `DELETE` 요청을 보낼 때 종료됩니다. 그런데 브라우저 탭이 닫히거나
클라이언트가 강제 종료되거나 프록시 구간에서 연결이 끊기면 `DELETE`가 오지 않고, 그런 세션은
서버 메모리에 계속 남습니다. 세션 하나가 `McpServer` 인스턴스를 통째로 붙들고 있어
방치하면 heap 이 세션 수에 비례해 늘어납니다.

이를 막기 위해 일정 시간 사용되지 않은 세션을 자동으로 정리합니다.

```typescript
McpServerModule.forRoot({
  session: {
    idleTimeoutMs: 30 * 60 * 1000, // 기본 30분. 0 이하면 자동 정리 비활성화
    sweepIntervalMs: 60 * 1000,    // 기본 1분. 만료 세션 검사 주기
  },
})
```

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `idleTimeoutMs` | `1800000` (30분) | 마지막 요청 이후 이 시간이 지난 세션을 닫습니다. |
| `sweepIntervalMs` | `60000` (1분) | 만료 세션을 검사하는 주기입니다. |

알아둘 점:

- **마지막 "요청" 시각을 기준으로 합니다.** 알림 수신용 SSE 스트림을 열어둔 것만으로는
  활성으로 보지 않으므로, 클라이언트가 `idleTimeoutMs` 동안 아무 요청도 보내지 않으면
  스트림이 열려 있어도 세션이 정리됩니다. 조용한 클라이언트를 오래 유지해야 한다면
  `idleTimeoutMs` 를 늘리세요.
- 정리된 세션으로 다시 요청하면 `404` 를 반환해 클라이언트가 재초기화하도록 유도합니다.
- 애플리케이션 종료 시 살아있는 세션을 모두 닫습니다. `SIGTERM` 같은 시그널에서도 동작하게
  하려면 `app.enableShutdownHooks()` 를 호출하세요.

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

등록된 프로바이더는 애플리케이션 부팅 시 한 번 스캔되어 도구·리소스 목록으로 확정됩니다.
런타임 중 동적으로 추가·제거되지 않습니다.

### 3. 클라이언트 설정

이 서버는 Streamable HTTP 전송을 사용하며, 엔드포인트는 기본적으로 `http://localhost:3000/mcp` 입니다.
(`app.setGlobalPrefix()` 를 사용한다면 그 경로가 앞에 붙습니다.)

**Claude Code (`.mcp.json`) 예시:**

```json
{
  "mcpServers": {
    "my-nestjs-server": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

**Claude Desktop 등 원격 URL을 직접 지원하지 않는 클라이언트:**

```json
{
  "mcpServers": {
    "my-nestjs-server": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/mcp"]
    }
  }
}
```

## 정의 가이드

### 도구(Tool) 정의

`BaseExecutor` 인터페이스를 구현하고 `execute` 메서드에 `@McpTool` 데코레이터를 사용합니다.

> **주의**: 도구를 실행할 때 호출되는 것은 언제나 클래스의 `execute` 메서드입니다.
> `execute` 가 없는 클래스의 `@McpTool` 메타데이터는 무시되고, 다른 이름의 메서드에 붙여도
> 실제로는 `execute` 가 실행됩니다. 도구 하나당 클래스 하나로 구성하고 `execute` 에 붙이세요.

```typescript
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseExecutor, ExecutorExtra, McpTool } from '@jissp/nestjs-mcp-server';

const properties = {
  a: z.number().describe('첫 번째 숫자'),
  b: z.number().describe('두 번째 숫자'),
};

type CalculateSumArgs = z.infer<z.ZodObject<typeof properties>>;

@Injectable()
export class CalculateSumExecutor implements BaseExecutor<CalculateSumArgs> {
  @McpTool({
    name: 'calculate-sum',
    description: '두 숫자의 합을 구합니다.',
    inputSchema: {
      type: 'object',
      properties,
      required: ['a', 'b'],
    },
  })
  public execute(args: CalculateSumArgs, extra: ExecutorExtra) {
    return { result: args.a + args.b };
  }
}
```

`inputSchema` 규칙:

| 항목 | 설명 |
| --- | --- |
| `properties` | 각 값은 **Zod 스키마**입니다. `.describe()` 로 붙인 설명이 클라이언트에 노출됩니다. |
| `required` | 필수 키 목록입니다. **이 배열에 없는 property 는 내부적으로 `.optional()` 처리되므로, `properties` 에 직접 `.optional()` 을 쓰지 마세요.** |
| 생략 시 | `inputSchema` 를 생략하면 인자 없는 도구가 됩니다. |

인자는 SDK 가 스키마로 검증한 뒤 전달하므로 executor 안에서 다시 검증할 필요가 없습니다.
반환값은 `JSON.stringify` 되어 `text` 콘텐츠로 감싸집니다.

### 리소스(Resource) 정의

메서드에 `@McpResource` 데코레이터를 사용하며, URI 템플릿(`{param}`)을 지원합니다.
도구와 달리 메서드 이름에 제약이 없습니다.

```typescript
import { Injectable } from '@nestjs/common';
import {
  ExecutorExtra,
  McpResource,
  McpResourceVariables,
} from '@jissp/nestjs-mcp-server';

@Injectable()
export class MyResourceService {
  @McpResource({
    uri: 'docs://{topic}',
    name: 'documentation',
    description: '주제별 문서를 제공합니다.',
    mimeType: 'text/markdown',
  })
  public async getDoc(variables: McpResourceVariables, extra: ExecutorExtra) {
    const { topic } = variables;

    return `Content for ${topic}...`;
  }
}
```

핸들러는 URI 템플릿에서 추출된 변수(`Record<string, string | string[]>`)를 첫 번째 인자로 받습니다.
반환값은 `JSON.stringify` 되어 `contents[0].text` 로 전달되며, `mimeType` 을 지정하지 않으면
`application/json` 이 사용됩니다.

하나의 메서드에 `@McpTool` 과 `@McpResource` 를 함께 붙여 도구와 리소스로 동시에 노출할 수도 있습니다.

## 실행 인터셉터

인증, 로깅, 메트릭처럼 모든 도구·리소스 실행에 공통으로 걸어야 하는 로직은 인터셉터로 분리합니다.
NestJS 의 HTTP 인터셉터와 달리 **MCP 실행 단위(도구 호출 / 리소스 읽기)** 를 감쌉니다.

```typescript
import { Injectable, Logger } from '@nestjs/common';
import {
  McpExecutionContext,
  McpExecutionHandler,
  McpExecutionInterceptor,
} from '@jissp/nestjs-mcp-server';

@Injectable()
export class LoggingInterceptor implements McpExecutionInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  public async intercept<T>(
    context: McpExecutionContext,
    next: McpExecutionHandler<T>,
  ): Promise<T> {
    this.logger.log(`${context.kind} ${context.name} 시작`);

    try {
      return await next();
    } finally {
      this.logger.log(`${context.kind} ${context.name} 종료`);
    }
  }
}
```

`forRoot()` 에 등록합니다. 인터셉터가 다른 모듈의 프로바이더를 주입받는다면 `imports` 에 해당 모듈을 넣으세요.

```typescript
McpServerModule.forRoot({
  imports: [AuthModule],
  interceptors: [AuthInterceptor, LoggingInterceptor], // 바깥 → 안쪽 순서
});
```

`McpExecutionContext` 멤버:

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `kind` | `McpExecutionKind` | `Tool` 또는 `Resource` |
| `name` | `string` | 도구 이름 또는 리소스 URI |
| `arguments` | `unknown` | 도구 인자 또는 리소스 URI 변수 |
| `extra` | `ExecutorExtra` | SDK 실행 컨텍스트 (`authInfo`, `signal`, `requestId`, `sessionId` 등) |

규칙:

- **반드시 `next()` 의 반환값을 그대로 반환해야 합니다.** `next()` 를 호출하지 않으면 실제 실행이 누락됩니다.
- 통과시키려면 `return next()`, 차단하려면 `throw` 합니다. 던진 예외는 SDK 가 JSON-RPC 에러로 변환합니다.
- 인터셉터를 등록하지 않으면 실행 체인이 구성되지 않아 기존과 동일하게 동작합니다.

## HTTP 엔드포인트

| 메서드 | 경로 | stateful | stateless |
| --- | --- | --- | --- |
| `POST` | `/mcp` | 클라이언트 → 서버 메시지. `initialize` 면 세션 생성, 이후에는 `mcp-session-id` 헤더로 세션 조회 | 요청마다 새 서버로 처리 (세션 없음) |
| `GET` | `/mcp` | 서버 → 클라이언트 SSE 알림 스트림 | `405` |
| `DELETE` | `/mcp` | 세션 종료 | `405` |

stateful 모드의 주요 오류 응답:

| 상황 | 상태 코드 | 의미 |
| --- | --- | --- |
| 만료·미존재 세션 ID | `404` | 클라이언트가 재초기화하도록 유도 |
| 세션 ID 도 없고 `initialize` 도 아닌 `POST` | `400` | 유효한 세션 없음 |
| `GET`/`DELETE` 에 세션 ID 누락 | `400` | 세션 ID 필요 |

## 아키텍처 및 요청 흐름

1. **메타데이터 스캔**: 부팅 시 `McpMetadataRegistryService` 가 `@McpTool` / `@McpResource` 를
   스캔해 도구·리소스 레지스트리를 구성합니다.
2. **등록 서술자 준비**: `McpServerService` 가 레지스트리를 `McpServer` 등록 형태(Zod raw shape,
   `ResourceTemplate`, 핸들러)로 **최초 1회만** 변환해 캐시합니다. 이 서술자는 무상태라 모든
   세션·요청이 공유합니다.
3. **트랜스포트 연결**: 요청이 들어오면 컨트롤러가 `McpServer` 인스턴스를 만들어
   `StreamableHTTPServerTransport` 에 연결합니다. stateful 은 세션당 1개를 만들어 보관하고,
   stateless 는 요청당 1개를 만들어 응답 후 즉시 닫습니다.
4. **핸들러 실행**: SDK 가 인자를 Zod 스키마로 검증한 뒤 핸들러를 호출하고, 핸들러는
   인터셉터 체인을 거쳐 executor/리소스 메서드를 실행합니다.
5. **응답 반환**: 결과가 직렬화되어 SSE 스트림 또는 단일 JSON 응답으로 클라이언트에 전달됩니다.

## 주요 export

| 이름 | 설명 |
| --- | --- |
| `McpServerModule` | `forRoot()` / `forFeature()` 를 제공하는 동적 모듈 |
| `McpTool`, `McpResource` | 도구·리소스 정의 데코레이터 |
| `BaseExecutor`, `ExecutorExtra` | executor 인터페이스와 SDK 실행 컨텍스트 타입 |
| `McpExecutionInterceptor`, `McpExecutionContext`, `McpExecutionHandler`, `McpExecutionKind` | 실행 인터셉터 관련 타입 |
| `McpServerRootOptions`, `McpServerFeatureOptions`, `McpSessionOptions`, `McpStatelessOptions`, `McpServerMode` | 모듈 옵션 타입 |
| `McpResourceVariables`, `McpResourceHandler` | 리소스 핸들러 관련 타입 |
| `McpMetadataRegistryService`, `McpServerService`, `McpSessionStore` | 내부 서비스 (직접 사용은 권장하지 않음) |
