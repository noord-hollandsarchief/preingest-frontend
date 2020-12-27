/**
 * An item that refers to zero or more dependencies.
 */
export interface DependentItem {
  id: string;
  // TODO can we get stronger typing?
  dependsOn: string[];
}

/**
 * Return all (nested) dependencies of `item` from `source`.
 */
export function getDependencies<T extends DependentItem>(item: T, source: T[]): T[] {
  if (item.dependsOn.length === 0) {
    return [];
  }
  const dependencies = source.filter((parent) => item.dependsOn.some((id) => id === parent.id));
  for (const dependency of [...dependencies]) {
    dependencies.push(...getDependencies(dependency, source));
  }
  return dependencies;
}

/**
 * Return all (nested) dependents of `item` from `source`.
 */
export function getDependents<T extends DependentItem>(item: T, source: T[]): T[] {
  const dependents = source.filter((child) => child.dependsOn.some((id) => id === item.id));
  for (const dependent of [...dependents]) {
    dependents.push(...getDependents(dependent, source));
  }
  return dependents;
}
