/**
 * 메타데이터 스캔 결과
 */
export interface ScannedMetadata {
    instance: any;
    methodName: string;
    metadata: any;
}

/**
 * 메타데이터 스캐너 설정
 */
export interface MetadataScannerConfig {
    metadataKey: string | symbol;
}
