import { DependentItem, getDependencies, getDependents } from '@/utils/dependentList';

const itemA = { id: 'a', dependsOn: [] };
const itemB = { id: 'b', dependsOn: [] };
const itemC = { id: 'c', dependsOn: ['b'] };
const itemD = { id: 'd', dependsOn: ['a', 'c'] };
// Forward reference
const itemE = { id: 'e', dependsOn: ['a', 'f'] };
const itemF = { id: 'f', dependsOn: ['b'] };
// E -> F, and F referenced directly as well
const itemG = { id: 'g', dependsOn: ['e', 'f', 'h'] };
const itemH = { id: 'h', dependsOn: [] };

const items: DependentItem[] = [itemA, itemB, itemC, itemD, itemE, itemF, itemG, itemH];

describe('getDependencies', () => {
  it('finds (nested) dependencies', () => {
    expect(getDependencies(itemA, items)).toEqual([]);
    expect(getDependencies(itemB, items)).toEqual([]);
    expect(getDependencies(itemC, items)).toEqual([itemB]);
    expect(getDependencies(itemD, items)).toEqual([itemA, itemC, itemB]);
    expect(getDependencies(itemE, items)).toEqual([itemA, itemF, itemB]);
    expect(getDependencies(itemF, items)).toEqual([itemB]);
    expect(getDependencies(itemG, items)).toEqual([itemE, itemF, itemH, itemA, itemB]);
    expect(getDependencies(itemH, items)).toEqual([]);
  });
});

describe('getDependents', () => {
  it('finds (nested) dependents', () => {
    expect(getDependents(itemA, items)).toEqual([itemD, itemE, itemG]);
    expect(getDependents(itemB, items)).toEqual([itemC, itemF, itemD, itemE, itemG]);
    expect(getDependents(itemC, items)).toEqual([itemD]);
    expect(getDependents(itemD, items)).toEqual([]);
    expect(getDependents(itemE, items)).toEqual([itemG]);
    expect(getDependents(itemF, items)).toEqual([itemE, itemG]);
    expect(getDependents(itemG, items)).toEqual([]);
    expect(getDependents(itemH, items)).toEqual([itemG]);
  });
});
