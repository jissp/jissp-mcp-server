import 'reflect-metadata';

export const MCP_SCHEMA_PROPERTIES_METADATA = 'MCP_SCHEMA_PROPERTIES_METADATA';

export interface McpSchemaPropertyOptions {
  type: string;
  description: string;
  isRequired: boolean;
}

export type McpSchemaPropertyOptionsMap = Map<string, McpSchemaPropertyOptions>;
type PropertyDecoratorArgs = Parameters<PropertyDecorator>;
type McpSchemaPropertiesMetadataResult =
  | McpSchemaPropertyOptionsMap
  | undefined;

export const McpSchemaProperty = (
  options: McpSchemaPropertyOptions,
): PropertyDecorator => {
  return (...args: PropertyDecoratorArgs) => {
    const [target, propertyKey] = args;

    if (!propertyKey) {
      return;
    }

    const key = String(propertyKey);

    updateMcpSchemaPropertiesMetadata(target, key, options);
  };
};

export function getMcpSchemaPropertiesMetadata(
  target: PropertyDecoratorArgs[0],
): McpSchemaPropertyOptionsMap {
  const metadata = Reflect.getMetadata(
    MCP_SCHEMA_PROPERTIES_METADATA,
    target,
  ) as McpSchemaPropertiesMetadataResult;
  if (!metadata) {
    return new Map<string, McpSchemaPropertyOptions>();
  }

  return metadata;
}

function setMcpSchemaPropertiesMetadata(
  mcpSchemaPropertiesMetadata: McpSchemaPropertyOptionsMap,
  target: PropertyDecoratorArgs[0],
  key: string,
  options: McpSchemaPropertyOptions,
) {
  mcpSchemaPropertiesMetadata.set(key, options);

  Reflect.defineMetadata(
    MCP_SCHEMA_PROPERTIES_METADATA,
    mcpSchemaPropertiesMetadata,
    target,
  );
}

function updateMcpSchemaPropertiesMetadata(
  target: PropertyDecoratorArgs[0],
  key: string,
  options: McpSchemaPropertyOptions,
) {
  const mcpSchemaPropertiesMetadata = getMcpSchemaPropertiesMetadata(target);
  setMcpSchemaPropertiesMetadata(
    mcpSchemaPropertiesMetadata,
    target,
    key,
    options,
  );
}
