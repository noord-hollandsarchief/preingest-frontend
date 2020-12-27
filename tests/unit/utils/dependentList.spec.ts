import { DependentItem, getDependencies, getDependents } from '@/utils/dependentList';

const itemA = { id: 'a', dependsOn: [] };
const itemB = { id: 'b', dependsOn: [] };
const itemC = { id: 'c', dependsOn: ['b'] };
const itemD = { id: 'd', dependsOn: ['a', 'c'] };
const itemE = { id: 'e', dependsOn: ['a', 'f'] };
const itemF = { id: 'f', dependsOn: ['b'] };

const items: DependentItem[] = [itemA, itemB, itemC, itemD, itemE, itemF];

describe('getDependencies', () => {
  it('finds (nested) dependencies', () => {
    expect(getDependencies(itemA, items)).toEqual([]);
    expect(getDependencies(itemB, items)).toEqual([]);
    expect(getDependencies(itemC, items)).toEqual([itemB]);
    expect(getDependencies(itemD, items)).toEqual([itemA, itemC, itemB]);
    expect(getDependencies(itemE, items)).toEqual([itemA, itemF, itemB]);
    expect(getDependencies(itemF, items)).toEqual([itemB]);
  });
});

describe('getDependents', () => {
  it('finds (nested) dependents', () => {
    expect(getDependents(itemA, items)).toEqual([itemD, itemE]);
    expect(getDependents(itemB, items)).toEqual([itemC, itemF, itemD, itemE]);
    expect(getDependents(itemC, items)).toEqual([itemD]);
    expect(getDependents(itemD, items)).toEqual([]);
    expect(getDependents(itemE, items)).toEqual([]);
    expect(getDependents(itemF, items)).toEqual([itemE]);
  });
});
