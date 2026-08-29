import { Logger } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readAllowToolsPolicy } from '../../lib/mcp-server/allow-tools';

describe('readAllowToolsPolicy', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'mcp-allow-tools-'));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  function writeConfig(content: string): string {
    const filePath = join(workDir, 'mcp-tools.json');
    writeFileSync(filePath, content, 'utf-8');

    return filePath;
  }

  it('옵션이 없으면 null 을 반환한다', () => {
    expect(readAllowToolsPolicy()).toBeNull();
  });

  it('빈 목록은 크기 0 인 Map 으로 로드된다', () => {
    const path = writeConfig('{"allowTools":{}}');

    const policy = readAllowToolsPolicy({ path });

    expect(policy).not.toBeNull();
    expect(policy?.size).toBe(0);
  });

  it('항목의 readOnly / destructive 를 그대로 담는다', () => {
    const path = writeConfig(
      '{"allowTools":{"a":{"readOnly":true},"b":{"destructive":false}}}',
    );

    const policy = readAllowToolsPolicy({ path });

    expect(policy?.get('a')?.readOnly).toBe(true);
    expect(policy?.get('b')?.destructive).toBe(false);
  });

  it('상대 경로는 process.cwd() 기준으로 해석된다', () => {
    const path = writeConfig('{"allowTools":{"a":{}}}');
    // cwd 를 '/' 로 바꿔치기하므로, 앞의 '/' 를 떼면 같은 파일을 가리키는 상대 경로가 된다.
    const relativePath = join('..', path.slice(1));
    const cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue('/');

    try {
      expect(resolve(process.cwd(), relativePath)).toBe(path);
      expect(readAllowToolsPolicy({ path: relativePath })?.has('a')).toBe(true);
    } finally {
      cwdSpy.mockRestore();
    }
  });

  it('알 수 없는 키는 무시하고 로드하되 경고를 남긴다', () => {
    const path = writeConfig(
      '{"allowResources":{},"allowTools":{"a":{"memo":"나중에","readOnly":true}}}',
    );
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const policy = readAllowToolsPolicy({ path });

    expect(policy?.size).toBe(1);
    expect(policy?.get('a')?.readOnly).toBe(true);
    // SDK 키 이름을 잘못 적어도 부팅은 되므로, 이 경고가 유일한 단서다.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'allowTools["a"] 의 알 수 없는 키를 무시합니다: memo',
      ),
    );

    warnSpy.mockRestore();
  });

  it('파일이 없으면 해석된 절대 경로와 함께 예외를 던진다', () => {
    const path = join(workDir, 'missing.json');

    expect(() => readAllowToolsPolicy({ path })).toThrow(
      `allowTools 파일을 읽을 수 없습니다: ${path}`,
    );
  });

  it('JSON 파싱에 실패하면 예외를 던진다', () => {
    const path = writeConfig('{ not json');

    expect(() => readAllowToolsPolicy({ path })).toThrow(
      '올바른 JSON 이 아닙니다',
    );
  });

  it('최상위가 객체가 아니면 예외를 던진다', () => {
    const path = writeConfig('[]');

    expect(() => readAllowToolsPolicy({ path })).toThrow(
      '최상위는 객체여야 합니다',
    );
  });

  it('allowTools 키가 없으면 예외를 던진다', () => {
    const path = writeConfig('{}');

    expect(() => readAllowToolsPolicy({ path })).toThrow(
      '"allowTools" 키가 없습니다',
    );
  });

  it('allowTools 가 객체가 아니면 예외를 던진다', () => {
    const path = writeConfig('{"allowTools":[]}');

    expect(() => readAllowToolsPolicy({ path })).toThrow(
      '"allowTools" 는 객체여야 합니다',
    );
  });

  it('항목이 객체가 아니면 이름과 함께 예외를 던진다', () => {
    const path = writeConfig('{"allowTools":{"a":"yes"}}');

    expect(() => readAllowToolsPolicy({ path })).toThrow(
      'allowTools["a"] 은 객체여야 합니다',
    );
  });

  it('readOnly 가 boolean 이 아니면 예외를 던진다', () => {
    const path = writeConfig('{"allowTools":{"a":{"readOnly":"true"}}}');

    expect(() => readAllowToolsPolicy({ path })).toThrow(
      'allowTools["a"].readOnly 는 boolean 이어야 합니다',
    );
  });

  it('destructive 가 boolean 이 아니면 예외를 던진다', () => {
    const path = writeConfig('{"allowTools":{"a":{"destructive":1}}}');

    expect(() => readAllowToolsPolicy({ path })).toThrow(
      'allowTools["a"].destructive 는 boolean 이어야 합니다',
    );
  });
});
