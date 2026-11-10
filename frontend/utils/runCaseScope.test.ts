import { describe, expect, it } from 'vitest';
import { isCaseInRun, pruneFoldersToCases } from './runCaseScope';
import { CaseType } from '@/types/case';
import { TreeNodeData } from '@/types/folder';

const buildCase = (id: number, folderId: number, editState?: string): CaseType =>
  ({
    id,
    folderId,
    RunCases: editState === undefined ? [] : [{ editState } as never],
  }) as unknown as CaseType;

const buildFolder = (id: string, children: TreeNodeData[] = []): TreeNodeData =>
  ({ id, name: `dossier ${id}`, children }) as unknown as TreeNodeData;

describe('isCaseInRun', () => {
  it('retient un cas lié à la campagne', () => {
    expect(isCaseInRun(buildCase(1, 1, 'new'))).toBe(true);
  });

  it('écarte un cas sans lien', () => {
    expect(isCaseInRun(buildCase(1, 1))).toBe(false);
  });

  it("écarte un cas dont le lien a été retiré : il subsiste en base", () => {
    expect(isCaseInRun(buildCase(1, 1, 'deleted'))).toBe(false);
  });
});

describe('pruneFoldersToCases', () => {
  it('garde un dossier qui porte un cas', () => {
    const tree = pruneFoldersToCases([buildFolder('1'), buildFolder('2')], [buildCase(1, 1, 'new')]);
    expect(tree.map((node) => node.id)).toEqual(['1']);
  });

  it('garde un parent vide dont un enfant porte un cas', () => {
    const tree = pruneFoldersToCases([buildFolder('1', [buildFolder('2')])], [buildCase(1, 2, 'new')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children?.map((node) => node.id)).toEqual(['2']);
  });

  it('rend un arbre vide quand aucun cas n’est dans le périmètre', () => {
    expect(pruneFoldersToCases([buildFolder('1', [buildFolder('2')])], [])).toEqual([]);
  });
});
