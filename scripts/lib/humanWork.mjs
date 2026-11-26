// Ce qui rend un cas insupprimable.
//
// Cette garde est le dernier rempart avant une suppression : elle vit à part
// pour être tenue par des tests, parce qu'un défaut ici ne se voit pas — il se
// constate après coup, sur ce qui a disparu.

import { isManagedTag } from './markerTags.mjs';

/** Les étiquettes de ce cas qu'une personne a posées, et non l'import. */
export const countHumanTags = (tags) => (tags ?? []).filter((tag) => !isManagedTag(tag?.name)).length;

/**
 * Ce cas porte-t-il le travail de quelqu'un ?
 *
 * Un avis, mais aussi un commentaire ou une pièce jointe : une capture d'écran
 * attachée à un constat EST la preuve du défaut, et elle ne se supprime pas
 * parce qu'un script a jugé le cas superflu.
 *
 * Une étiquette compte aussi, à condition qu'une personne l'ait posée : celles
 * du vocabulaire des marqueurs viennent de l'import, et les compter rendrait
 * tout cas insupprimable.
 */
export const hasHumanWork = ({ played, verdicts = 0, comments = 0, attachments = 0, humanTags = 0 }) =>
  Boolean(played) || verdicts > 0 || comments > 0 || attachments > 0 || humanTags > 0;

/** Ce qu'il porte, en toutes lettres — pour que la liste le dise, pas seulement le compte. */
export const workLabel = (entry) => {
  const parts = [];
  if (entry.played || entry.verdicts > 0) parts.push('un avis');
  if (entry.comments > 0) parts.push(entry.comments > 1 ? `${entry.comments} commentaires` : 'un commentaire');
  if (entry.attachments > 0)
    parts.push(entry.attachments > 1 ? `${entry.attachments} pièces jointes` : 'une pièce jointe');
  if (entry.humanTags > 0) parts.push(entry.humanTags > 1 ? `${entry.humanTags} étiquettes` : 'une étiquette');
  return parts.length > 0 ? `  ⚠ porte ${parts.join(', ')}` : '';
};
