/** 화이트리스트 JSON 의 개별 Tool 항목 */
export interface McpToolAllowEntry {
  /** MCP `readOnlyHint` 로 전달. 미지정 시 클라이언트는 false(환경을 변경함) 로 간주한다. */
  readOnly?: boolean;
  /** MCP `destructiveHint` 로 전달. 미지정 시 클라이언트는 true(파괴적) 로 간주한다. */
  destructive?: boolean;
}

/**
 * 로드된 화이트리스트. `null` 은 "미설정(전체 공개)" 이며,
 * 크기 0 인 Map 은 "빈 목록(전체 비공개)" 으로 서로 다른 의미다.
 */
export type McpAllowToolsPolicy = ReadonlyMap<string, McpToolAllowEntry>;

/** forRoot() 의 allowTools 옵션 */
export interface McpAllowToolsOptions {
  /** 화이트리스트 JSON 파일 경로. 상대 경로는 process.cwd() 기준으로 해석된다. */
  path: string;
}
