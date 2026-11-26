// Les marqueurs des plans, rendus visibles dans l'instance sous forme
// d'étiquettes.
//
// Ces étiquettes appartiennent à l'import : lui seul les pose et les retire.
// Toute étiquette absente de cette table est l'œuvre d'une personne, et le
// nettoyage s'y fie pour épargner un cas.

/** Marqueur du pivot → nom de l'étiquette. Le nom fait 3 à 20 caractères. */
export const TAG_BY_MARKER = {
  securite: 'Sécurité',
  calcul: 'Calcul',
  attention: 'Vigilance',
  pdf: 'PDF',
  email: 'Email',
  responsive: 'Mobile',
  dev: 'Préparation',
  'couvert-playwright': 'Playwright',
};

export const MANAGED_TAG_NAMES = Object.values(TAG_BY_MARKER);

const managed = new Set(MANAGED_TAG_NAMES);

/** Cette étiquette est-elle posée par l'import, plutôt que par une personne ? */
export const isManagedTag = (name) => managed.has(String(name ?? '').trim());

/** Les étiquettes que ces marqueurs appellent, sans doublon et dans l'ordre de la table. */
export const tagNamesForMarkers = (markers) => {
  const wanted = new Set();
  for (const marker of markers ?? []) {
    const name = TAG_BY_MARKER[marker];
    if (name) {
      wanted.add(name);
    }
  }
  return MANAGED_TAG_NAMES.filter((name) => wanted.has(name));
};
