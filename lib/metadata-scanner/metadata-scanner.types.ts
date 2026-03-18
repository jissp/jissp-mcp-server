import { Reflector } from '@nestjs/core';

/**
 * 메타데이터 스캔 결과
 */
export interface ScannedMetadata<Instance = unknown, Metadata = any> {
  instance: Instance;
  metadata: Metadata;
  methodName: string;
  isClassMetadata: boolean;
}

/**
 * 메타데이터 스캔 결과
 */
export interface ScannedPropertyMetadata<T = undefined> {
  key: string;
  metadata: T;
}

/**
 * 메타데이터 스캐너 설정
 */
export interface MetadataScannerConfig<T> {
  decorator: DecoratorReturnType<T>;
}

export type DecoratorReturnType<T> = ReturnType<
  typeof Reflector.createDecorator<T>
>;

export type ConstructorType = new (...args: any[]) => any;
