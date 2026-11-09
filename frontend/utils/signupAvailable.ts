import Config from '@/config/config';

const apiServer = Config.apiServer;

/**
 * Une instance peut fermer la création de compte. En cas de doute — serveur
 * muet, réponse illisible — on répond ouvert : refuser l'inscription sur une
 * panne de réseau enfermerait dehors la première personne qui arrive.
 */
export async function fetchSignupEnabled() {
  try {
    // Sans `no-store`, Next garderait la première réponse : rouvrir ou fermer
    // l'instance demanderait alors de reconstruire l'image, pas de redémarrer
    // le conteneur.
    const res = await fetch(`${apiServer}/users/signup/enabled`, { cache: 'no-store' });
    const data = await res.json();

    return data.enabled ?? true;
  } catch (e) {
    console.error('Failed to fetch sign up status', e);
    return true;
  }
}
