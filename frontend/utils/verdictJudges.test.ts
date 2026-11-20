import { describe, it, expect } from 'vitest';
import { initialsOf, orderJudges, judgesDisagree } from './verdictJudges';
import type { RunCaseVerdictType } from '@/types/case';

const verdict = (userId: number | null, username: string, status: number): RunCaseVerdictType => ({
  userId,
  username,
  status,
});

describe('initialsOf', () => {
  it('prend la première et la dernière initiale', () => {
    expect(initialsOf('Nadège Loubaki')).toBe('NL');
    expect(initialsOf('Marie Claire Okemba')).toBe('MO');
  });

  it('prend deux lettres d’un prénom seul', () => {
    expect(initialsOf('serge')).toBe('SE');
  });

  it('ignore les mots qui ne commencent pas par une lettre', () => {
    expect(initialsOf('Recette (local)')).toBe('RL');
  });

  it('garde les lettres accentuées', () => {
    expect(initialsOf('Élodie Mbemba')).toBe('ÉM');
  });

  it('rend un point d’interrogation pour un compte supprimé', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('orderJudges', () => {
  const nadege = verdict(1, 'Nadège Loubaki', 1);
  const serge = verdict(2, 'Serge Ngoma', 2);
  const ruth = verdict(3, 'Ruth Bemba', 1);

  it('met l’avis de qui regarde en tête', () => {
    expect(orderJudges([nadege, serge, ruth], 2)).toEqual([serge, nadege, ruth]);
  });

  it('ne touche à rien quand la personne n’a pas jugé', () => {
    expect(orderJudges([nadege, serge], 3)).toEqual([nadege, serge]);
  });

  it('ne touche à rien pour une personne non identifiée', () => {
    expect(orderJudges([nadege, serge], null)).toEqual([nadege, serge]);
  });
});

describe('judgesDisagree', () => {
  it('voit un désaccord entre deux statuts différents', () => {
    expect(judgesDisagree([verdict(1, 'A', 1), verdict(2, 'B', 2)])).toBe(true);
  });

  it('ne voit pas de désaccord quand tout le monde dit la même chose', () => {
    expect(judgesDisagree([verdict(1, 'A', 1), verdict(2, 'B', 1), verdict(3, 'C', 1)])).toBe(false);
  });

  it('ne voit pas de désaccord sur un avis unique ni sur aucun', () => {
    expect(judgesDisagree([verdict(1, 'A', 2)])).toBe(false);
    expect(judgesDisagree([])).toBe(false);
  });
});
