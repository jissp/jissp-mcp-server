import { Module } from '@nestjs/common';
import { MetadataScannerService } from './metadata-scanner.service';
import { DiscoveryModule } from '@nestjs/core';

@Module({
    imports: [DiscoveryModule],
    providers: [MetadataScannerService],
    exports: [MetadataScannerService],
})
export class MetadataScannerModule {}
