import { Injectable, OnModuleInit } from '@nestjs/common';
import { MetadataScannerService } from '@jissp/metadata-scanner';
import {
  McpResource,
  McpResourceOptions,
  McpTool,
  McpToolOptions,
} from './decorators';
import { McpResourceHandler } from './mcp-server.types';
import { BaseExecutor } from './base.executor';

export interface McpToolEntry {
  executor: BaseExecutor;
  metadata: McpToolOptions;
}

export interface McpResourceEntry {
  handler: McpResourceHandler;
  metadata: McpResourceOptions;
}

@Injectable()
export class McpMetadataRegistryService implements OnModuleInit {
  private tools = new Map<string, McpToolEntry>();
  private resources = new Map<string, McpResourceEntry>();

  constructor(private readonly metadataScanner: MetadataScannerService) {}

  onModuleInit() {
    this.scanTools();
    this.scanResources();
  }

  private scanTools() {
    const metadataList = this.metadataScanner.scan<McpToolOptions>({
      decorator: McpTool,
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
      decorator: McpResource,
    });

    metadataList.forEach(
      ({ metadata, instance, methodName, isClassMetadata }) => {
        if (isClassMetadata || !this.isCallableFunction(instance, methodName)) {
          return;
        }

        this.resources.set(metadata.uri, {
          handler: instance[methodName].bind(instance) as McpResourceHandler,
          metadata,
        });
      },
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
