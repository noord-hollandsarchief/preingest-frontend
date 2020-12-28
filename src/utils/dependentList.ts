/**
 * An item that refers to zero or more dependencies.
 */
export interface DependentItem {
  id: string;
  dependsOn: string[];
}

/**
 * Return all (nested) dependencies of `item` from `source`.
 */
export function getDependencies<T extends DependentItem>(item: T, source: T[]): T[] {
  if (item.dependsOn.length === 0) {
    return [];
  }
  // Use a Set to support combinations of direct and nested references to the same dependency
  const dependencies = new Set(
    source.filter((parent) => item.dependsOn.some((id) => id === parent.id))
  );
  for (const dependency of dependencies) {
    getDependencies(dependency, source).forEach((d) => dependencies.add(d));
  }
  return [...dependencies];
}

/**
 * Return all (nested) dependents of `item` from `source`.
 */
export function getDependents<T extends DependentItem>(item: T, source: T[]): T[] {
  const dependents = new Set(
    source.filter((child) => child.dependsOn.some((id) => id === item.id))
  );
  for (const dependent of dependents) {
    getDependents(dependent, source).forEach((d) => dependents.add(d));
  }
  return [...dependents];
}
