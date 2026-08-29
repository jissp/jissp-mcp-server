import { Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  McpAllowToolsOptions,
  McpAllowToolsPolicy,
  McpToolAllowEntry,
} from './mcp-allow-tools.types';

const ALLOW_TOOLS_KEY = 'allowTools';
const ENTRY_KEYS = ['readOnly', 'destructive'] as const;

const logger = new Logger('McpAllowToolsPolicy');

/**
 * 화이트리스트 파일을 읽어 정책으로 변환한다.
 * 옵션이 없으면 `null`(미설정 = 전체 공개), 설정 오류는 예외로 알린다.
 */
export function readAllowToolsPolicy(
  options?: McpAllowToolsOptions,
): McpAllowToolsPolicy | null {
  if (!options) {
    return null;
  }

  const filePath = resolve(process.cwd(), options.path);
  const raw = readAllowToolsFile(filePath);
  const parsed = parseJson(raw, filePath);

  return toPolicy(parsed, filePath);
}

function readAllowToolsFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`allowTools 파일을 읽을 수 없습니다: ${filePath}`, {
      cause: error,
    });
  }
}

function parseJson(raw: string, filePath: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`allowTools 파일이 올바른 JSON 이 아닙니다: ${filePath}`, {
      cause: error,
    });
  }
}

function toPolicy(parsed: unknown, filePath: string): McpAllowToolsPolicy {
  if (!isPlainObject(parsed)) {
    throw new Error(`allowTools 파일의 최상위는 객체여야 합니다: ${filePath}`);
  }

  if (!(ALLOW_TOOLS_KEY in parsed)) {
    throw new Error(
      `allowTools 파일에 "${ALLOW_TOOLS_KEY}" 키가 없습니다: ${filePath}`,
    );
  }

  const allowTools = parsed[ALLOW_TOOLS_KEY];
  if (!isPlainObject(allowTools)) {
    throw new Error(`"${ALLOW_TOOLS_KEY}" 는 객체여야 합니다: ${filePath}`);
  }

  const policy = new Map<string, McpToolAllowEntry>();
  for (const [toolName, entry] of Object.entries(allowTools)) {
    policy.set(toolName, toAllowEntry(toolName, entry, filePath));
  }

  return policy;
}

function toAllowEntry(
  toolName: string,
  entry: unknown,
  filePath: string,
): McpToolAllowEntry {
  if (!isPlainObject(entry)) {
    throw new Error(
      `allowTools["${toolName}"] 은 객체여야 합니다: ${filePath}`,
    );
  }

  warnUnknownKeys(entry, toolName, filePath);

  return {
    readOnly: readOptionalBoolean(entry, 'readOnly', toolName, filePath),
    destructive: readOptionalBoolean(entry, 'destructive', toolName, filePath),
  };
}

/**
 * 스키마에 없는 키는 확장 여지를 위해 무시하되, 조용히 넘어가지는 않는다.
 * `readOnlyHint` 처럼 SDK 키 이름을 잘못 적어도 부팅은 되므로 이 로그가 유일한 단서다.
 */
function warnUnknownKeys(
  entry: Record<string, unknown>,
  toolName: string,
  filePath: string,
) {
  const unknownKeys = Object.keys(entry).filter(
    (key) => !ENTRY_KEYS.includes(key as (typeof ENTRY_KEYS)[number]),
  );

  if (unknownKeys.length > 0) {
    logger.warn(
      `allowTools["${toolName}"] 의 알 수 없는 키를 무시합니다: ${unknownKeys.join(', ')} (${filePath})`,
    );
  }
}

function readOptionalBoolean(
  entry: Record<string, unknown>,
  key: 'readOnly' | 'destructive',
  toolName: string,
  filePath: string,
): boolean | undefined {
  const value = entry[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(
      `allowTools["${toolName}"].${key} 는 boolean 이어야 합니다: ${filePath}`,
    );
  }

  return value;
}

// 배열과 null 을 객체로 오인하지 않도록 typeof 만으로 판정하지 않는다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
