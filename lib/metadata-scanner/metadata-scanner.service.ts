import { Injectable } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import {
  MetadataScannerConfig,
  ScannedMetadata,
  ScannedPropertyMetadata,
} from './metadata-scanner.types';
import { isConstructorType } from './utils';
import { JISSP_PROPERTY_DECORATOR } from './decorators';

@Injectable()
export class MetadataScannerService {
  constructor(
    private readonly reflector: Reflector,
    private readonly discovery: DiscoveryService,
  ) {}

  /**
   * 모든 프로바이더에서 특정 메타데이터를 스캔 (메서드/클래스용)
   */
  scan<Metadata>(
    config: MetadataScannerConfig<Metadata>,
  ): ScannedMetadata<object, Metadata>[] {
    const results: ScannedMetadata<object, Metadata>[] = [];

    const controllers = this.discovery.getControllers();
    const providers = this.discovery.getProviders();
    const wrappers = [...controllers, ...providers];

    for (const { instance } of wrappers) {
      if (!this.isObject(instance)) {
        continue;
      }

      const prototype = Object.getPrototypeOf(instance);
      if (!prototype) {
        continue;
      }

      const methodNames = this.getMethodNames(prototype);
      for (const methodName of methodNames) {
        const targetMethod = (instance as Record<string, unknown>)[methodName];
        if (typeof targetMethod !== 'function') {
          continue;
        }

        const metadata = this.reflector.get<Metadata>(
          config.decorator,
          targetMethod,
        );
        if (!metadata) {
          continue;
        }

        results.push({
          instance,
          methodName,
          metadata,
          isClassMetadata: methodName === 'constructor',
        });
      }
    }

    return results;
  }

  scanProperties<Metadata>(
    metadataKey: string | symbol,
    target: any,
  ): ScannedPropertyMetadata<Metadata>[] {
    const _target = isConstructorType(target)
      ? target.prototype
      : Object.getPrototypeOf(target);

    const properties = Reflect.getMetadata(
      JISSP_PROPERTY_DECORATOR,
      _target,
    ) as string[];

    return properties.map((property) => ({
      key: property,
      metadata: Reflect.getMetadata(metadataKey, _target, property) as Metadata,
    }));
  }

  /**
   * 프로토타입에서 모든 메서드 이름 추출
   */
  private getMethodNames(prototype: object): string[] {
    return Object.getOwnPropertyNames(prototype).filter((methodName) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);

      return descriptor && typeof descriptor.value === 'function';
    });
  }

  /**
   * 객체 타입 여부 확인 (Type Guard)
   */
  private isObject(val: unknown): val is object {
    if (!val) {
      return false;
    }

    return typeof val === 'object';
  }
}
