import { Injectable, Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { McpServerModule } from '../../lib/mcp-server/mcp-server.module';
import { McpMetadataRegistryService } from '../../lib/mcp-server/mcp-metadata-registry.service';
import { McpResource, McpTool } from '../../lib/mcp-server/decorators';
import type { McpAllowToolsOptions } from '../../lib/mcp-server/allow-tools';

const idProperties = { id: z.string().describe('대상 식별자') };

@Injectable()
class SearchExecutor {
  @McpTool({
    name: 'search-items',
    description: '항목을 조회한다',
    inputSchema: { type: 'object', properties: idProperties, required: ['id'] },
  })
  public execute(args: { id: string }) {
    return { found: args.id };
  }
}

/** Tool 과 Resource 를 한 메서드에 함께 단다. 화이트리스트 우회 경고를 검증하기 위한 구성이다. */
@Injectable()
class DeleteExecutor {
  @McpTool({
    name: 'delete-item',
    description: '항목을 삭제한다',
    inputSchema: { type: 'object', properties: idProperties, required: ['id'] },
  })
  @McpResource({
    uri: 'item:///delete/{id}',
    name: 'delete-item',
    mimeType: 'application/json',
  })
  public execute(args: { id: string }) {
    return { deleted: args.id };
  }
}

@Module({
  imports: [
    McpServerModule.forFeature({ executors: [SearchExecutor, DeleteExecutor] }),
  ],
})
class ItemDomainModule {}

function appModule(allowTools?: McpAllowToolsOptions) {
  @Module({
    imports: [McpServerModule.forRoot({ allowTools }), ItemDomainModule],
  })
  class AppModule {}

  return AppModule;
}

/**
 * 로더 오류는 provider 생성 중에 터지고, Nest 기본값(`abortOnError: true`)은 이를
 * `process.exit(1)` 로 바꿔 버려 테스트가 관측할 수 없다. 그래서 항상 꺼 둔다.
 */
function createContext(
  allowTools?: McpAllowToolsOptions,
): Promise<INestApplicationContext> {
  return NestFactory.createApplicationContext(appModule(allowTools), {
    abortOnError: false,
    logger: false,
  });
}

function toolNamesOf(context: INestApplicationContext): string[] {
  return context
    .get(McpMetadataRegistryService)
    .getToolEntries()
    .map(({ metadata }) => metadata.name)
    .sort();
}

/**
 * 단위 테스트는 `McpAllowToolsRegistry` 를 provider 로 직접 꽂으므로
 * `McpAllowToolsModule` → `McpMetadataRegistryService` 배선이 끊겨도 통과한다.
 * 그 배선이 끊기면 필터가 사라져 **전체 공개**로 조용히 떨어지므로,
 * 실제 컨테이너를 띄워 `forRoot({ allowTools })` 경로 전체를 확인한다.
 */
describe('McpServerModule.forRoot({ allowTools }) 배선', () => {
  let workDir: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), 'mcp-allow-tools-wiring-'));
  });

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  function writeConfig(
    fileName: string,
    content: string,
  ): McpAllowToolsOptions {
    const path = join(workDir, fileName);
    writeFileSync(path, content, 'utf-8');

    return { path };
  }

  it('미설정이면 선언된 Tool 을 모두 공개한다', async () => {
    const context = await createContext();

    expect(toolNamesOf(context)).toEqual(['delete-item', 'search-items']);

    await context.close();
  });

  it('허용 목록에 있는 Tool 만 공개하고 annotation 을 붙인다', async () => {
    const options = writeConfig(
      'allow.json',
      '{"allowTools":{"search-items":{"readOnly":true}}}',
    );

    const context = await createContext(options);
    const entries = context.get(McpMetadataRegistryService).getToolEntries();

    expect(entries.map(({ metadata }) => metadata.name)).toEqual([
      'search-items',
    ]);
    expect(entries[0].annotations).toEqual({ readOnlyHint: true });

    await context.close();
  });

  it('빈 목록은 전체 비공개로 동작한다', async () => {
    const options = writeConfig('empty.json', '{"allowTools":{}}');

    const context = await createContext(options);

    expect(toolNamesOf(context)).toEqual([]);

    await context.close();
  });

  it('선언되지 않은 Tool 이름이 있으면 부팅에 실패한다', async () => {
    const options = writeConfig(
      'typo.json',
      '{"allowTools":{"search-item":{}}}',
    );

    await expect(createContext(options)).rejects.toThrow(
      /allowTools 에 적힌 Tool 이 어디에도 선언되어 있지 않습니다: search-item/,
    );
  });

  it('스키마 타입 오류가 있으면 부팅에 실패한다', async () => {
    const options = writeConfig(
      'invalid.json',
      '{"allowTools":{"search-items":{"readOnly":"true"}}}',
    );

    await expect(createContext(options)).rejects.toThrow(
      /allowTools\["search-items"\].readOnly 는 boolean 이어야 합니다/,
    );
  });

  it('파일이 없으면 부팅에 실패한다', async () => {
    const path = join(workDir, 'missing.json');

    await expect(createContext({ path })).rejects.toThrow(
      `allowTools 파일을 읽을 수 없습니다: ${path}`,
    );
  });

  it('감춘 Tool 이 Resource 로 남아 있으면 경고를 남긴다', async () => {
    const options = writeConfig(
      'hide-delete.json',
      '{"allowTools":{"search-items":{}}}',
    );
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const context = await createContext(options);

    expect(toolNamesOf(context)).toEqual(['search-items']);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'allowTools 로 감춘 Tool 이 Resource 로는 여전히 실행 가능합니다: delete-item -> item:///delete/{id}',
      ),
    );

    warnSpy.mockRestore();
    await context.close();
  });
});
