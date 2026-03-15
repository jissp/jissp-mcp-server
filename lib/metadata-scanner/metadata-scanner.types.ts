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
 * 메타데이터 스캐너 설정
 */
export interface MetadataScannerConfig {
  metadataKey: string | symbol;
}
