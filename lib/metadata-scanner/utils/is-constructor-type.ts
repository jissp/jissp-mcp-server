import { ConstructorType } from '../metadata-scanner.types';

export function isConstructorType(object: unknown): object is ConstructorType {
  return typeof object === 'function';
}
