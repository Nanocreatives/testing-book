import { describe, it, expect } from 'vitest';
import { countHumanTags, hasHumanWork, workLabel } from './humanWork.mjs';

const vide = { played: false, verdicts: 0, comments: 0, attachments: 0, humanTags: 0 };

describe('countHumanTags', () => {
  it('ne compte pas les étiquettes posées par l’import', () => {
    expect(countHumanTags([{ name: 'Sécurité' }, { name: 'Vigilance' }])).toBe(0);
  });

  it('compte celles qu’une personne a posées', () => {
    expect(countHumanTags([{ name: 'Sécurité' }, { name: 'Défaut connu' }])).toBe(1);
  });

  it('tient sur rien du tout', () => {
    expect(countHumanTags([])).toBe(0);
    expect(countHumanTags(undefined)).toBe(0);
    expect(countHumanTags([{}])).toBe(1);
  });
});

describe('hasHumanWork', () => {
  it('un cas vierge est supprimable', () => {
    expect(hasHumanWork(vide)).toBe(false);
  });

  it.each([
    ['joué', { played: true }],
    ['un avis', { verdicts: 1 }],
    ['un commentaire', { comments: 1 }],
    ['une pièce jointe', { attachments: 1 }],
    ['une étiquette humaine', { humanTags: 1 }],
  ])('%s le rend insupprimable', (_, porte) => {
    expect(hasHumanWork({ ...vide, ...porte })).toBe(true);
  });

  // Le piège de ce changement : l'import pose une étiquette sur la plupart des
  // cas. Si elles comptaient, plus rien ne serait jamais supprimable et le
  // nettoyage se tairait sans qu'on sache pourquoi.
  it('les seules étiquettes de l’import ne protègent pas un cas', () => {
    expect(hasHumanWork({ ...vide, humanTags: countHumanTags([{ name: 'Sécurité' }, { name: 'Calcul' }]) })).toBe(
      false
    );
  });

  it('se contente d’un objet incomplet', () => {
    expect(hasHumanWork({})).toBe(false);
    expect(hasHumanWork({ played: true })).toBe(true);
  });
});

describe('workLabel', () => {
  it('ne dit rien sur un cas vierge', () => {
    expect(workLabel(vide)).toBe('');
  });

  it('nomme chaque chose, au singulier comme au pluriel', () => {
    expect(workLabel({ ...vide, humanTags: 1 })).toBe('  ⚠ porte une étiquette');
    expect(workLabel({ ...vide, humanTags: 3 })).toBe('  ⚠ porte 3 étiquettes');
    expect(workLabel({ ...vide, played: true, comments: 2, humanTags: 1 })).toBe(
      '  ⚠ porte un avis, 2 commentaires, une étiquette'
    );
  });
});
