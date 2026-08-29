import { Test } from '@nestjs/testing';
import { MetadataScannerService } from '@jissp/metadata-scanner';
import type { ScannedMetadata } from '@jissp/metadata-scanner';
import { McpTool, McpToolOptions } from '../../lib/mcp-server/decorators';
import { McpMetadataRegistryService } from '../../lib/mcp-server/mcp-metadata-registry.service';
import {
  McpAllowToolsRegistry,
  McpToolAllowEntry,
} from '../../lib/mcp-server/allow-tools';

function toolMetadata(name: string): ScannedMetadata<object, McpToolOptions> {
  return {
    instance: { execute: jest.fn() },
    metadata: { name },
    methodName: 'execute',
    isClassMetadata: false,
  };
}

/** scan() 은 Tool·Resource 로 각각 한 번씩 호출되므로 decorator 로 분기해야 한다. */
function createScannerStub(tools: ScannedMetadata<object, McpToolOptions>[]) {
  return {
    scan: jest.fn(({ decorator }: { decorator: unknown }) =>
      decorator === McpTool ? tools : [],
    ),
  };
}

async function createRegistry(
  toolNames: string[],
  allowTools: Record<string, McpToolAllowEntry> | null,
): Promise<McpMetadataRegistryService> {
  const policy =
    allowTools === null ? null : new Map(Object.entries(allowTools));
  const moduleRef = await Test.createTestingModule({
    providers: [
      McpMetadataRegistryService,
      {
        provide: MetadataScannerService,
        useValue: createScannerStub(toolNames.map(toolMetadata)),
      },
      {
        provide: McpAllowToolsRegistry,
        useValue: new McpAllowToolsRegistry(policy),
      },
    ],
  }).compile();

  return moduleRef.get(McpMetadataRegistryService);
}

describe('McpMetadataRegistryService', () => {
  it('화이트리스트가 없으면 선언된 Tool 을 모두 공개하고 annotation 을 붙이지 않는다', async () => {
    const registry = await createRegistry(['a', 'b', 'c'], null);

    registry.onModuleInit();

    const entries = registry.getToolEntries();
    expect(entries).toHaveLength(3);
    expect(entries.every(({ annotations }) => annotations === undefined)).toBe(
      true,
    );
  });

  it('화이트리스트가 아예 주입되지 않아도 전체 공개로 동작한다', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        McpMetadataRegistryService,
        {
          provide: MetadataScannerService,
          useValue: createScannerStub([toolMetadata('a')]),
        },
      ],
    }).compile();
    const registry = moduleRef.get(McpMetadataRegistryService);

    registry.onModuleInit();

    expect(registry.getToolEntries()).toHaveLength(1);
  });

  it('화이트리스트에 있는 Tool 만 공개한다', async () => {
    const registry = await createRegistry(['a', 'b', 'c'], { b: {} });

    registry.onModuleInit();

    expect(
      registry.getToolEntries().map(({ metadata }) => metadata.name),
    ).toEqual(['b']);
  });

  it('빈 화이트리스트는 전체 비공개로 동작한다', async () => {
    const registry = await createRegistry(['a', 'b'], {});

    registry.onModuleInit();

    expect(registry.getToolEntries()).toHaveLength(0);
  });

  it('화이트리스트 항목의 annotation 을 entry 에 싣는다', async () => {
    const registry = await createRegistry(['a', 'b'], {
      a: { readOnly: true },
      b: {},
    });

    registry.onModuleInit();

    const entries = registry.getToolEntries();
    expect(entries[0].annotations).toEqual({ readOnlyHint: true });
    expect(entries[1].annotations).toBeUndefined();
  });

  it('선언되지 않은 Tool 이름이 화이트리스트에 있으면 예외를 던진다', async () => {
    const registry = await createRegistry(['search-items'], {
      'search-item': {},
    });

    expect(() => registry.onModuleInit()).toThrow(
      'allowTools 에 적힌 Tool 이 어디에도 선언되어 있지 않습니다: search-item',
    );
  });
});
