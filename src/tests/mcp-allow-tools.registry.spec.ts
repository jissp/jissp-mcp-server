import {
  McpAllowToolsPolicy,
  McpAllowToolsRegistry,
  McpToolAllowEntry,
} from '../../lib/mcp-server/allow-tools';

function registryOf(
  entries: Record<string, McpToolAllowEntry> | null,
): McpAllowToolsRegistry {
  const policy: McpAllowToolsPolicy | null =
    entries === null ? null : new Map(Object.entries(entries));

  return new McpAllowToolsRegistry(policy);
}

describe('McpAllowToolsRegistry', () => {
  describe('정책이 없을 때', () => {
    const registry = registryOf(null);

    it('모든 이름을 허용한다', () => {
      expect(registry.isAllowed('무엇이든')).toBe(true);
    });

    it('annotation 을 만들지 않는다', () => {
      expect(registry.getAnnotations('무엇이든')).toBeUndefined();
    });

    it('대조할 이름이 없다', () => {
      expect(registry.getAllowedNames()).toEqual([]);
    });
  });

  describe('빈 정책일 때', () => {
    const registry = registryOf({});

    it('아무 이름도 허용하지 않는다', () => {
      expect(registry.isAllowed('a')).toBe(false);
    });

    it('대조할 이름이 없다', () => {
      expect(registry.getAllowedNames()).toEqual([]);
    });
  });

  describe('정책이 있을 때', () => {
    const registry = registryOf({
      a: { readOnly: true },
      b: { readOnly: false, destructive: true },
      c: {},
    });

    it('정책에 있는 이름만 허용한다', () => {
      expect(registry.isAllowed('a')).toBe(true);
      expect(registry.isAllowed('z')).toBe(false);
    });

    it('지정된 값만 SDK 키로 옮기고 나머지 키는 만들지 않는다', () => {
      const annotations = registry.getAnnotations('a');

      expect(annotations).toEqual({ readOnlyHint: true });
      expect(annotations && 'destructiveHint' in annotations).toBe(false);
    });

    it('두 값이 모두 있으면 둘 다 옮긴다', () => {
      expect(registry.getAnnotations('b')).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
      });
    });

    it('지정된 값이 없는 항목은 undefined 를 반환한다', () => {
      expect(registry.getAnnotations('c')).toBeUndefined();
    });

    it('허용되지 않은 이름은 undefined 를 반환한다', () => {
      expect(registry.getAnnotations('z')).toBeUndefined();
    });

    it('정책에 적힌 이름을 모두 돌려준다', () => {
      expect(registry.getAllowedNames()).toEqual(['a', 'b', 'c']);
    });
  });
});
