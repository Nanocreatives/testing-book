/** Les seuls schémas qui mènent à un site. */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * L'adresse est-elle sûre à poser dans un `href` ?
 *
 * Le serveur refuse déjà tout le reste à l'écriture. Cette vérification est un
 * doublon volontaire : une base peut porter une valeur écrite avant cette règle,
 * ou par un autre chemin, et `javascript:` dans un `href` s'exécute au clic.
 * Ce qu'on affiche se vérifie au moment de l'afficher.
 */
export function isSafeTestUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  try {
    return ALLOWED_PROTOCOLS.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
