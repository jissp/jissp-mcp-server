import { Injectable } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import {
    MetadataScannerConfig,
    ScannedMetadata,
} from './metadata-scanner.types';

@Injectable()
export class MetadataScannerService {
    constructor(
        private readonly reflector: Reflector,
        private readonly discovery: DiscoveryService,
    ) {}

    /**
     * 모든 프로바이더에서 특정 메타데이터를 스캔
     */
    scan(config: MetadataScannerConfig): ScannedMetadata[] {
        const results: ScannedMetadata[] = [];
        const controllers = this.discovery.getControllers();
        const providers = this.discovery.getProviders();

        const wrappers = [...controllers, ...providers];
        wrappers.forEach(({ instance }) => {
            if (!instance || typeof instance !== 'object') {
                return;
            }

            const prototype = Object.getPrototypeOf(instance);
            if (!prototype) {
                return;
            }

            const methodNames = this.getMethodNames(prototype);
            methodNames.forEach((methodName) => {
                const metadata = this.reflector.get<any>(
                    config.metadataKey,
                    instance[methodName],
                );
                if (!metadata) {
                    return;
                }

                const result: ScannedMetadata = {
                    instance,
                    methodName,
                    metadata,
                };

                results.push(result);
            });
        });

        return results;
    }

    /**
     * 프로토타입에서 모든 메서드 이름 추출
     */
    private getMethodNames(prototype: any): string[] {
        return Object.getOwnPropertyNames(prototype).filter((methodName) => {
            const descriptor = Object.getOwnPropertyDescriptor(
                prototype,
                methodName,
            );

            return (
                descriptor &&
                typeof descriptor.value === 'function' &&
                methodName !== 'constructor'
            );
        });
    }
}
