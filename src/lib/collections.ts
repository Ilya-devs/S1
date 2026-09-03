/** Return a value as an array without trusting an external/API response shape. */
export function asArray<T>(value: T[] | T | null | undefined): T[] {
  return Array.isArray(value) ? value as T[] : []
}
