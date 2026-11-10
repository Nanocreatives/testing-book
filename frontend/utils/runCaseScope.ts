import { CaseType } from '@/types/case';
import { TreeNodeData } from '@/types/folder';

/**
 * Un cas appartient à la campagne dès qu'il porte un lien non supprimé. Le lien
 * subsiste après un retrait — `editState` vaut alors `deleted` — et le compter
 * ferait apparaître dans la campagne des cas qu'on en a sortis.
 */
export const isCaseInRun = (testCase: CaseType): boolean => {
  const link = testCase.RunCases?.[0];
  return link !== undefined && link.editState !== 'deleted';
};

/**
 * Élague l'arbre des dossiers pour ne garder que ceux qui portent un cas du
 * périmètre, ou dont un descendant en porte un. Sur un projet de cent dossiers
 * dont une campagne n'en touche que onze, l'arbre entier cache ce qu'on cherche.
 */
export function pruneFoldersToCases(nodes: TreeNodeData[], cases: CaseType[]): TreeNodeData[] {
  const populated = new Set(cases.map((testCase) => testCase.folderId.toString()));

  const keep = (node: TreeNodeData): TreeNodeData | null => {
    const children = (node.children ?? []).map(keep).filter((child): child is TreeNodeData => child !== null);
    if (!populated.has(node.id) && children.length === 0) {
      return null;
    }
    return { ...node, children };
  };

  return nodes.map(keep).filter((node): node is TreeNodeData => node !== null);
}
