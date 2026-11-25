// L'adresse du site à tester, saisie par un humain et rendue en lien cliquable.
//
// Ce couple — champ libre d'un côté, `href` de l'autre — est un vecteur
// d'injection classique : `javascript:alert(1)` saisi par un gestionnaire
// s'exécuterait dans le navigateur de chaque testeur qui clique. La validation
// vit donc au serveur, qui seul peut refuser pour de bon.

/** Les seuls schémas qui mènent à un site. */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * L'adresse retenue, ou `null` si le champ est vide.
 *
 * Lève sur une adresse inacceptable plutôt que de la corriger en silence : une
 * adresse rafistolée mènerait ailleurs que là où son auteur croit l'envoyer.
 */
export function normalizeTestUrl(raw) {
  if (raw === undefined || raw === null) {
    return null;
  }

  const trimmed = String(raw).trim();
  if (trimmed === '') {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('INVALID_TEST_URL');
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error('INVALID_TEST_URL');
  }

  return parsed.toString();
}

/**
 * L'adresse est-elle sûre à poser dans un `href` ?
 *
 * Doublon volontaire de la validation d'écriture : une base peut porter une
 * valeur écrite avant cette règle, ou par un autre chemin. Ce qu'on affiche se
 * vérifie au moment de l'afficher.
 */
export function isSafeTestUrl(value) {
  if (!value) {
    return false;
  }
  try {
    return ALLOWED_PROTOCOLS.includes(new URL(String(value)).protocol);
  } catch {
    return false;
  }
}
