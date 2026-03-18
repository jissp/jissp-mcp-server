export const JISSP_PROPERTY_DECORATOR = Symbol.for('JISSP_PROPERTY_DECORATOR');

type PropertyDecoratorArgs = Parameters<PropertyDecorator>;

export function createPropertyDecorator<T = undefined>(metadataKey: string) {
  return (options: T) => {
    return (...args: PropertyDecoratorArgs) => {
      const [target, propertyKey] = args;
      if (!propertyKey) {
        return;
      }

      const key = String(propertyKey);

      // 1. 기존 방식: 전체 맵(Map)에 업데이트 (기존 코드와 호환)
      updatePropertiesMetadata(target, key);

      // 2. 표준 방식: 개별 속성 키에도 직접 메타데이터 정의 (scanProperties용)
      Reflect.defineMetadata(metadataKey, options, target, propertyKey);
    };
  };
}

export function getPropertiesMetadata(
  target: PropertyDecoratorArgs[0],
): string[] {
  const metadata = Reflect.getMetadata(
    JISSP_PROPERTY_DECORATOR,
    target,
  ) as string[];
  if (metadata) {
    return metadata;
  }

  return [];
}

function setMcpSchemaPropertiesMetadata(
  properties: string[],
  target: PropertyDecoratorArgs[0],
  key: string,
) {
  properties.push(key);

  Reflect.defineMetadata(JISSP_PROPERTY_DECORATOR, properties, target);
}

function updatePropertiesMetadata(
  target: PropertyDecoratorArgs[0],
  key: string,
) {
  const properties = getPropertiesMetadata(target);
  setMcpSchemaPropertiesMetadata(properties, target, key);
}
