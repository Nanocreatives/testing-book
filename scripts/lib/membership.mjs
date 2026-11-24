/**
 * Le rôle du compte sur un projet, et le refus qui va avec.
 *
 * `/cases/byproject` filtre sa réponse pour un `reporter` : il ne reçoit que les
 * cas de son ressort. Tout script qui lit cette route et conclut quelque chose
 * sur LA campagne doit donc refuser de tourner sous un tel compte, sous peine
 * d'annoncer un silence qu'il n'a pas constaté — « aucun cas joué » parce qu'il
 * n'a pas pu les voir.
 *
 * Partagé plutôt que recopié : un garde-fou en trois exemplaires finit par
 * diverger, et c'est toujours la copie oubliée qui tourne le jour où ça compte.
 */

/** L'index EST la valeur stockée — `frontend/config/selection.ts`. */
const REPORTER_ROLE = 2;

/**
 * Arrête le script si le compte n'est que `reporter` sur ce projet.
 *
 * `api` est la fonction d'appel du script appelant — chacun a la sienne, avec
 * son jeton déjà posé.
 */
export const refuseReporter = async ({ api, project, email, why }) => {
  const memberships = await api('GET', '/members/check');
  const rows = Array.isArray(memberships) ? memberships : (memberships?.data ?? []);
  const membership = rows.find((m) => Number(m.projectId) === Number(project.id));

  if (!membership || membership.isOwner || membership.role !== REPORTER_ROLE) {
    return;
  }

  console.error(
    `\nLe compte ${email} est « reporter » sur « ${project.name} ».\n\n` +
      `La liste des cas lui est filtrée : il ne voit que les siens. ${why}\n\n` +
      'Relancer avec un compte gestionnaire ou propriétaire du projet.'
  );
  process.exit(1);
};
