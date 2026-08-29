import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { MetadataScannerService } from '@jissp/metadata-scanner';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import {
  McpResource,
  McpResourceOptions,
  McpTool,
  McpToolOptions,
} from './decorators';
import { McpResourceHandler } from './mcp-server.types';
import { BaseExecutor } from './base.executor';
import { McpAllowToolsRegistry } from './allow-tools';

export interface McpToolEntry {
  executor: BaseExecutor;
  metadata: McpToolOptions;
  /** 화이트리스트에서 지정된 MCP annotation. 지정값이 없으면 undefined */
  annotations?: ToolAnnotations;
}

export interface McpResourceEntry {
  handler: McpResourceHandler;
  metadata: McpResourceOptions;
}

/**
 * 화이트리스트에서 걸러진 Tool 이 어느 메서드에 선언돼 있었는지.
 * 같은 메서드가 Resource 로도 노출됐는지 대조하는 데만 쓴다.
 */
interface HiddenToolMethod {
  toolName: string;
  instance: object;
  methodName: string;
}

@Injectable()
export class McpMetadataRegistryService implements OnModuleInit {
  private tools = new Map<string, McpToolEntry>();
  private resources = new Map<string, McpResourceEntry>();
  /** 화이트리스트 필터와 무관하게, 스캔으로 발견한 모든 Tool 이름 */
  private declaredToolNames = new Set<string>();
  /** 화이트리스트에서 걸러진 Tool 들. Resource 우회 경고에만 쓴다. */
  private hiddenToolMethods: HiddenToolMethod[] = [];
  private readonly logger = new Logger(McpMetadataRegistryService.name);

  constructor(
    private readonly metadataScanner: MetadataScannerService,
    // 유니온 타입(`X | null`)으로 적으면 design:paramtypes 에 Object 가 방출되어
    // DI 가 토큰을 해석하지 못한다. 그래서 토큰을 명시한다.
    @Optional()
    @Inject(McpAllowToolsRegistry)
    private readonly allowTools?: McpAllowToolsRegistry,
  ) {}

  onModuleInit() {
    this.scanTools();
    this.assertAllAllowedToolsDeclared();
    this.scanResources();
  }

  private scanTools() {
    const metadataList = this.metadataScanner.scan<McpToolOptions>({
      decorator: McpTool,
    });

    metadataList.forEach(
      ({ metadata, instance, methodName, isClassMetadata }) => {
        if (isClassMetadata || !this.isBaseExecutor(instance)) {
          return;
        }

        // 필터에서 걸러진 Tool 도 "선언되었다"는 사실은 남아야 미선언 검출이 정확해진다.
        this.declaredToolNames.add(metadata.name);

        const isAllowed = this.allowTools?.isAllowed(metadata.name) ?? true;
        if (!isAllowed) {
          this.hiddenToolMethods.push({
            toolName: metadata.name,
            instance,
            methodName,
          });
          return;
        }

        this.tools.set(metadata.name, {
          executor: instance,
          metadata,
          annotations: this.allowTools?.getAnnotations(metadata.name),
        });
      },
    );
  }

  /** 화이트리스트에는 있으나 선언되지 않은 Tool 이름을 검출한다. */
  private assertAllAllowedToolsDeclared() {
    const undeclared = (this.allowTools?.getAllowedNames() ?? []).filter(
      (name) => !this.declaredToolNames.has(name),
    );

    if (undeclared.length > 0) {
      // 원인이 셋(이름 오타 / executor 미등록 / execute() 누락)이라 메시지로 좁혀 준다.
      throw new Error(
        `allowTools 에 적힌 Tool 이 어디에도 선언되어 있지 않습니다: ${undeclared.join(', ')}. ` +
          `이름 오타, executor 의 forFeature 미등록, execute() 누락을 확인하세요.`,
      );
    }
  }

  private scanResources() {
    const metadataList = this.metadataScanner.scan<McpResourceOptions>({
      decorator: McpResource,
    });

    const bypassed: string[] = [];

    metadataList.forEach(
      ({ metadata, instance, methodName, isClassMetadata }) => {
        if (isClassMetadata || !this.isCallableFunction(instance, methodName)) {
          return;
        }

        this.resources.set(metadata.uri, {
          handler: instance[methodName].bind(instance) as McpResourceHandler,
          metadata,
        });

        const hiddenToolName = this.findHiddenToolName(instance, methodName);
        if (hiddenToolName) {
          bypassed.push(`${hiddenToolName} -> ${metadata.uri}`);
        }
      },
    );

    this.warnBypassedTools(bypassed);
  }

  private findHiddenToolName(
    instance: object,
    methodName: string,
  ): string | undefined {
    return this.hiddenToolMethods.find(
      (hidden) =>
        hidden.instance === instance && hidden.methodName === methodName,
    )?.toolName;
  }

  /**
   * 화이트리스트로 감춘 Tool 이 같은 메서드의 Resource 로는 여전히 실행 가능함을 알린다.
   * 이번 범위에서 Resource 는 화이트리스트 대상이 아니므로 차단하지 않고 경고만 남긴다.
   * Tool 을 감춘 것을 "그 기능이 차단됐다" 로 오해하면 실제보다 안전하다고 믿게 된다.
   */
  private warnBypassedTools(bypassed: string[]) {
    if (bypassed.length === 0) {
      return;
    }

    this.logger.warn(
      `allowTools 로 감춘 Tool 이 Resource 로는 여전히 실행 가능합니다: ${bypassed[0]} 외 ${bypassed.length - 1}개`,
    );
  }

  getToolEntries(): McpToolEntry[] {
    return Array.from(this.tools.values());
  }

  getResourceEntries(): McpResourceEntry[] {
    return Array.from(this.resources.values());
  }

  private isBaseExecutor(instance: any): instance is BaseExecutor {
    return this.isCallableFunction(instance, 'execute');
  }

  private isCallableFunction(
    instance: any,
    methodName: string,
  ): instance is Record<string, CallableFunction> {
    return (
      methodName in instance &&
      typeof (instance as Record<string, unknown>)[methodName] === 'function'
    );
  }
}
