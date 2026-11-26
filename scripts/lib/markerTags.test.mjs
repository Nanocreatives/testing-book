import { describe, it, expect } from 'vitest';
import { TAG_BY_MARKER, MANAGED_TAG_NAMES, isManagedTag, tagNamesForMarkers } from './markerTags.mjs';

describe('le vocabulaire des étiquettes de marqueur', () => {
  it('tient dans ce que l’API accepte : 3 à 20 caractères', () => {
    for (const name of MANAGED_TAG_NAMES) {
      expect(name.length, name).toBeGreaterThanOrEqual(3);
      expect(name.length, name).toBeLessThanOrEqual(20);
      expect(name, name).toBe(name.trim());
    }
  });

  it('ne donne jamais deux marqueurs au même nom', () => {
    expect(new Set(MANAGED_TAG_NAMES).size).toBe(MANAGED_TAG_NAMES.length);
  });

  // Un cas en porte cinq au plus, et l'import ne doit pas consommer la place
  // d'une personne. Trois marqueurs est le maximum observé sur les plans.
  it('laisse de la place aux étiquettes humaines', () => {
    const tousLesMarqueurs = Object.keys(TAG_BY_MARKER);
    expect(tagNamesForMarkers(['securite', 'calcul', 'attention'])).toHaveLength(3);
    expect(tousLesMarqueurs.length).toBeLessThanOrEqual(MANAGED_TAG_NAMES.length);
  });
});

describe('tagNamesForMarkers', () => {
  it('traduit les marqueurs connus', () => {
    expect(tagNamesForMarkers(['securite'])).toEqual(['Sécurité']);
    expect(tagNamesForMarkers(['couvert-playwright'])).toEqual(['Playwright']);
  });

  it('rend un ordre stable, quel que soit celui de l’entrée', () => {
    expect(tagNamesForMarkers(['attention', 'securite'])).toEqual(tagNamesForMarkers(['securite', 'attention']));
  });

  it('ignore un marqueur inconnu et ne double pas un marqueur répété', () => {
    expect(tagNamesForMarkers(['securite', 'securite', 'inconnu'])).toEqual(['Sécurité']);
  });

  it('rend une liste vide sur rien', () => {
    expect(tagNamesForMarkers([])).toEqual([]);
    expect(tagNamesForMarkers(undefined)).toEqual([]);
  });
});

describe('isManagedTag', () => {
  it('reconnaît une étiquette de l’import', () => {
    expect(isManagedTag('Vigilance')).toBe(true);
    expect(isManagedTag(' Sécurité ')).toBe(true);
  });

  it('laisse une étiquette humaine en dehors', () => {
    for (const name of ['Défaut connu', 'À confirmer', 'Bloqué — donnée', 'Rejeu', '', null, undefined]) {
      expect(isManagedTag(name), String(name)).toBe(false);
    }
  });

  // `{}.toString` existe sur le prototype : une recherche naïve dans un objet
  // rendrait cette étiquette gérée, et l'import l'arracherait à son auteur.
  it('ne se fait pas prendre par une propriété du prototype', () => {
    expect(isManagedTag('toString')).toBe(false);
    expect(isManagedTag('constructor')).toBe(false);
  });
});
