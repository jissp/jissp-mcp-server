import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { MetadataScannerService } from './metadata-scanner.service';

@Module({
  imports: [DiscoveryModule],
  providers: [MetadataScannerService],
  exports: [MetadataScannerService],
})
export class MetadataScannerModule {}
