import { isSettled } from './verdictAggregate.js';

/**
 * Whether someone else's verdict must be hidden from this viewer.
 *
 * Seeing that a colleague already passed a case ANCHORS the next verdict — the
 * bias is universal and good will does not fix it. Without blinding, "all
 * testers gave the same status" measures conformity, not reproducibility, and
 * the agreement column of the tracking report is worth nothing.
 *
 * Only the cases where anchoring can still do damage are hidden: the viewer has
 * not weighed in, somebody else has, and the case is still short of the verdicts
 * it asks for. A settled case hides nothing — nobody is being asked any more.
 */
export function isBlindForViewer({ statuses, viewerHasVoted, expected, eligibleCount }) {
  if (viewerHasVoted || statuses.length === 0) {
    return false;
  }
  return !isSettled(statuses.length, expected, eligibleCount);
}

/**
 * The status to publish to this viewer, and whether it was withheld.
 *
 * A withheld status is published as untested rather than omitted: anything that
 * does not know about blinding still reads a valid status, and the flag tells
 * the screen to say "already judged — give your own verdict" instead of
 * pretending nobody has looked.
 */
export function publishedStatus({ status, blind }) {
  return blind ? 0 : status;
}
