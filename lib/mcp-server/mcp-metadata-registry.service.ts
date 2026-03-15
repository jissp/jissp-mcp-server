import { Injectable, OnModuleInit } from '@nestjs/common';
import { MetadataScannerService } from '../metadata-scanner';
import {
  MCP_RESOURCE_METADATA,
  MCP_TOOL_METADATA,
  McpResourceOptions,
  McpToolOptions,
} from './decorators';
import { BaseExecutor } from './base.executor';

@Injectable()
export class McpMetadataRegistryService implements OnModuleInit {
  private tools = new Map<
    string,
    { executor: BaseExecutor; metadata: McpToolOptions }
  >();
  private resources = new Map<
    string,
    { handler: CallableFunction; metadata: McpResourceOptions }
  >();

  constructor(private readonly metadataScanner: MetadataScannerService) {}

  onModuleInit() {
    this.scanTools();
    this.scanResources();
  }

  private scanTools() {
    const metadataList = this.metadataScanner.scan<McpToolOptions>({
      metadataKey: MCP_TOOL_METADATA,
    });

    metadataList.forEach(({ metadata, instance, isClassMetadata }) => {
      if (isClassMetadata || !this.isBaseExecutor(instance)) {
        return;
      }

      this.tools.set(metadata.name, {
        executor: instance,
        metadata,
      });
    });
  }

  private scanResources() {
    const metadataList = this.metadataScanner.scan<McpResourceOptions>({
      metadataKey: MCP_RESOURCE_METADATA,
    });

    metadataList.forEach(
      ({ metadata, instance, methodName, isClassMetadata }) => {
        if (isClassMetadata || !this.isCallableFunction(instance, methodName)) {
          return;
        }

        this.resources.set(metadata.uri, {
          handler: instance[methodName].bind(instance),
          metadata,
        });
      },
    );
  }

  getTools() {
    return Array.from(this.tools.values()).map((t) => t.metadata);
  }

  getToolExecutor(name: string) {
    return this.tools.get(name)?.executor;
  }

  getResources() {
    return Array.from(this.resources.values()).map((r) => r.metadata);
  }

  getResourceHandler(uri: string) {
    for (const [template, resource] of this.resources.entries()) {
      const match = this.matchUri(template, uri);
      if (match) {
        return {
          handler: resource.handler,
          params: match,
        };
      }
    }
    return null;
  }

  private matchUri(
    template: string,
    uri: string,
  ): Record<string, string> | null {
    const paramNames: string[] = [];
    const regexSource = template.replace(/{([^}]+)}/g, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });

    const regex = new RegExp(`^${regexSource}$`);
    const match = uri.match(regex);
    if (!match) {
      return null;
    }

    const params: Record<string, string> = {};
    paramNames.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1]);
    });

    return params;
  }

  private isBaseExecutor(instance: any): instance is BaseExecutor {
    return this.isCallableFunction(instance, 'execute');
  }

  private isCallableFunction(
    instance: any,
    methodName: string,
  ): instance is {
    [methodName]: CallableFunction;
  } {
    return methodName in instance && typeof instance[methodName] === 'function';
  }
}
