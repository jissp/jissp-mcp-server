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
- **무상태(stateless) 동작**: 세션을 보관하지 않아 누수가 구조적으로 불가능하고 수평 확장이 자유롭습니다.

## 0.3.0 변경점 (breaking)

0.2.x 에서 올라온다면 아래를 먼저 확인하세요. **세션 유지(stateful) 동작이 제거되어
라이브러리가 무상태 단일 동작으로 통일**되었습니다.

### 제거된 `forRoot()` 옵션

| 0.2.x | 0.3.0 |
| --- | --- |
| `mode: 'stateful' \| 'stateless'` | 제거. 항상 무상태로 동작합니다. |
| `session: { idleTimeoutMs, sweepIntervalMs }` | 제거. 보관하는 세션이 없어 정리할 대상도 없습니다. |
| `stateless: { enableJsonResponse }` | 최상위 `enableJsonResponse` 로 이동 |

### 제거된 export

`McpSessionStore`, `McpStatelessController`, `MCP_SESSION_OPTIONS`, `MCP_STATELESS_OPTIONS`,
`McpServerMode`, `McpSessionOptions`, `McpStatelessOptions`, `McpServerConfig`(미사용 타입)

### 조용히 깨지는 경우 — 반드시 확인하세요

옵션을 넘기던 코드는 컴파일 에러로 즉시 드러납니다. 문제는 **아무 옵션 없이 기본값(0.2.x 의 stateful)으로
쓰면서 서버→클라이언트 방향 통신에 의존하던 경우**입니다. 이 코드는 **컴파일이 통과한 채 런타임에
기능만 잃습니다.**

```bash
grep -rnE "extra\.(sendNotification|sendRequest|sessionId|closeSSEStream|closeStandaloneSSEStream)" src/
```

| 검색 결과 | 판단 |
| --- | --- |
| 0건 | 그대로 올려도 됩니다. |
| `sessionId` 만 사용 | 올릴 수 있습니다. `extra.requestId` 나 인터셉터에서 발급하는 요청 단위 ID 로 대체하세요. |
| `sendNotification` / `sendRequest` 사용 | 올릴 수 없습니다. 알림·sampling·elicitation 이 필요하면 **0.2.x 에 머무르세요.** |

`GET`/`DELETE` `/mcp` 는 이제 `405` 를 반환합니다. 클라이언트 쪽 설정 변경은 필요 없습니다
(자세한 내용은 아래 「세션을 보관하지 않습니다」 참고).

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

`forRoot()` 옵션은 다음과 같습니다. 모두 선택 사항입니다.

| 옵션 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `interceptors` | `Type<McpExecutionInterceptor>[]` | `[]` | 실행 인터셉터 (배열 순서 = 바깥→안쪽) |
| `enableJsonResponse` | `boolean` | `false` | SSE 스트림 대신 단일 JSON 으로 응답 |
| `allowTools` | `McpAllowToolsOptions` | — | 공개할 Tool 화이트리스트 |
| `imports` | `ModuleMetadata['imports']` | `[]` | 인터셉터 등이 의존하는 모듈 |

#### 세션을 보관하지 않습니다

이 라이브러리는 세션을 일절 보관하지 않습니다. 요청 하나마다 `McpServer` 와 트랜스포트를
새로 만들고 응답이 끝나면 즉시 닫습니다.

| | 동작 |
| --- | --- |
| 세션 보관 | 하지 않음 |
| `McpServer` 생성 | **요청당 1개** (응답 후 즉시 폐기) |
| 세션 누수 | **구조적으로 발생 불가** |
| 로드밸런서 | **세션 어피니티 불필요, 수평 확장 자유** |
| 프로세스 재시작 | 끊길 세션이 없음 |
| `GET`(SSE) / `DELETE` | `405` 반환 |
| 서버→클라이언트 알림 | **불가** |
| sampling / elicitation | **불가** |
| `extra.sessionId` | 항상 `undefined` |

요청당 추가되는 비용은 tool 123개 + resource 123개 기준 **약 0.45ms / 628KB** 이며,
응답이 끝나는 즉시 GC 대상이 됩니다.

executor 나 인터셉터에서 서버→클라이언트 방향 통신을 쓸 수는 없습니다. 유지되는 세션을
전제로 하는 기능이기 때문입니다.

```bash
grep -rnE "extra\.(sendNotification|sendRequest|sessionId|closeSSEStream|closeStandaloneSSEStream)" src/
```

| 검색 결과 | 판단 |
| --- | --- |
| 0건 | 그대로 사용 가능 |
| `sessionId` 만 사용 | `extra.requestId` 나 인터셉터에서 발급하는 요청 단위 ID 로 대체하세요. |
| `sendNotification` / `sendRequest` 사용 | 이 라이브러리로는 구현할 수 없습니다. |

`extra` 의 나머지 멤버(`signal`, `authInfo`, `requestId`, `_meta`, `requestInfo`)는
그대로 동작합니다.

MCP 클라이언트는 별도 설정이 필요 없습니다. 평소처럼 `initialize` 를 보내고, 응답에
`mcp-session-id` 가 실리지 않으면 이후 요청에도 세션 헤더를 붙이지 않습니다.

#### JSON 응답 옵션

```typescript
McpServerModule.forRoot({
  enableJsonResponse: true, // 기본 false
});
```

SSE 스트림 대신 단일 JSON 으로 응답합니다. 요청과 응답이 1:1 이라 스트림이 필요 없고,
CloudFront 같은 중간 프록시의 SSE 버퍼링 문제를 피할 수 있습니다.

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

## Tool 공개 화이트리스트 (allowTools)

`forRoot()` 에 `allowTools` 를 지정하면, **JSON 파일에 명시된 Tool 만** 공개됩니다.
지정하지 않으면 선언된 모든 Tool 이 공개되며, 이는 기존 동작과 동일합니다.

### 화이트리스트 파일

```json
{
  "allowTools": {
    "search-items": { "readOnly": true },
    "create-item": { "destructive": false },
    "delete-item": { "destructive": true },
    "ping": {}
  }
}
```

| 키 | 설명 |
| --- | --- |
| `readOnly` | MCP `readOnlyHint`. **명시하지 않으면 클라이언트는 `false`(환경을 변경함)로 간주합니다.** |
| `destructive` | MCP `destructiveHint`. **명시하지 않으면 클라이언트는 `true`(파괴적)로 간주합니다.** |

항목은 빈 객체 `{}` 도 유효하며 "옵션 없이 공개" 를 뜻합니다.
알 수 없는 키는 무시되지만, `readOnly` 에 boolean 이 아닌 값을 주면 기동에 실패합니다.

### 모듈 설정

```typescript
McpServerModule.forRoot({
  allowTools: { path: './mcp-tools.json' },
})
```

상대 경로는 **프로세스 실행 위치(`process.cwd()`)** 기준입니다.

화이트리스트는 **파일로만** 전달합니다. `forRoot()` 에 목록을 직접 적는 인라인 옵션은 없습니다.
같은 코드를 배포한 서버들이 서로 다른 집합을 공개하는 것이 이 기능의 목적이기 때문입니다.

### 파일 배치

**파일은 서버 하나당 하나입니다.** 프로젝트 루트에 두는 것으로 충분합니다.

```
mcp-tools.json
```

같은 코드를 여러 서버로 배포하면서 서버마다 공개 집합을 달리할 때만 파일을 나눕니다.
그때는 `path` 에 환경변수를 넣어 어느 파일을 쓸지 고르면 됩니다.

```typescript
allowTools: { path: process.env.MCP_TOOLS_CONFIG ?? './mcp-tools.json' },
```

배치는 관례일 뿐 라이브러리가 강제하지 않습니다. 다만 상대 경로가 프로세스 실행 위치 기준이므로,
컨테이너에서 실행한다면 **워킹 디렉토리 기준으로 경로가 맞는지** 확인하세요.

### 기동에 실패하는 경우

설정 오류는 조용히 넘어가지 않고 **부팅을 중단**시킵니다.

- 파일이 없거나 읽을 수 없음
- JSON 파싱 실패 / 스키마 불일치
- 화이트리스트에 있으나 어느 executor 에도 선언되지 않은 Tool 이름

마지막 항목은 이름 오타뿐 아니라 **executor 를 `forFeature` 에 등록하지 않은 경우, `execute()` 가 없는
클래스에 `@McpTool` 을 붙인 경우**에도 발생합니다. 예외 메시지가 세 원인을 함께 안내합니다.

`readOnly` / `destructive` 외의 키는 향후 확장을 위해 무시하지만, 무시했다는 사실을 부팅 시
`WARN` 으로 남깁니다. `readOnlyHint` 처럼 SDK 키 이름을 잘못 적었을 때 이 로그가 유일한 단서입니다.

전체 비공개를 원한다면 `{"allowTools": {}}` 라고 **명시**하세요.
`allowTools` 키가 없는 파일은 스키마 오류입니다.

### 주의

- 화이트리스트는 **서버 단위의 노출 경계**이며 요청자별 인가 수단이 아닙니다.
  요청자별 제어가 필요하면 실행 인터셉터를 사용하세요.
- **`@McpResource` 는 화이트리스트의 영향을 받지 않습니다.** 한 메서드에 `@McpTool` 과
  `@McpResource` 를 함께 붙였다면, Tool 을 감춰도 Resource 경로로는 여전히 실행됩니다.
  이 상태를 감지하면 부팅 시 `WARN` 을 남깁니다.
  (`allowTools 로 감춘 Tool 이 Resource 로는 여전히 실행 가능합니다: <tool> -> <uri>`)
- 화이트리스트 파일은 **배포 산출물에 포함**되어야 합니다. 누락 시 기동에 실패합니다.
- 화이트리스트는 부팅 시 1회만 읽습니다. 파일을 고쳤다면 **재기동**해야 반영됩니다.

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

| 메서드 | 경로 | 동작 |
| --- | --- | --- |
| `POST` | `/mcp` | 클라이언트 → 서버 메시지. 요청마다 새 서버로 처리 |
| `GET` | `/mcp` | `405` (유지할 SSE 스트림이 없음) |
| `DELETE` | `/mcp` | `405` (종료할 세션이 없음) |

## 아키텍처 및 요청 흐름

1. **메타데이터 스캔**: 부팅 시 `McpMetadataRegistryService` 가 `@McpTool` / `@McpResource` 를
   스캔해 도구·리소스 레지스트리를 구성합니다.
2. **등록 서술자 준비**: `McpServerService` 가 레지스트리를 `McpServer` 등록 형태(Zod raw shape,
   `ResourceTemplate`, 핸들러)로 **최초 1회만** 변환해 캐시합니다. 이 서술자는 무상태라 모든
   세션·요청이 공유합니다.
3. **트랜스포트 연결**: 요청이 들어오면 컨트롤러가 `McpServer` 인스턴스를 만들어
   `StreamableHTTPServerTransport` 에 연결합니다. 요청당 1개를 만들어 응답 후 즉시 닫습니다.
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
| `McpServerRootOptions`, `McpServerFeatureOptions` | 모듈 옵션 타입 |
| `McpAllowToolsOptions`, `McpToolAllowEntry`, `McpAllowToolsPolicy` | Tool 화이트리스트 관련 타입 |
| `McpAllowToolsModule`, `McpAllowToolsRegistry`, `readAllowToolsPolicy` | Tool 화이트리스트 모듈·조회 서비스·정책 로더 |
| `McpResourceVariables`, `McpResourceHandler` | 리소스 핸들러 관련 타입 |
| `McpMetadataRegistryService`, `McpServerService` | 내부 서비스 (직접 사용은 권장하지 않음) |
