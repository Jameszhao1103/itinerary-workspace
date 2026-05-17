import { escapeHtml } from "./shared.js";

export function collectReviewHistoryEntries(trip) {
  const conflictsById = new Map((trip?.conflicts ?? []).map((conflict) => [conflict.id, conflict]));
  return (trip?.review_decisions ?? [])
    .filter((decision) => decision.decision === "accepted")
    .map((decision) => {
      const conflict = conflictsById.get(decision.conflict_id) ?? null;
      return {
        id: decision.id,
        conflictId: decision.conflict_id,
        message: decision.conflict_message ?? conflict?.message ?? "Reviewed conflict",
        type: decision.conflict_type ?? conflict?.type ?? "conflict",
        reason: decision.reason ?? "",
        decidedAt: decision.decided_at ?? "",
        decidedBy: decision.decided_by ?? "user",
        dayDate: decision.day_date ?? null,
        itemIds: decision.item_ids ?? conflict?.item_ids ?? [],
        active: Boolean(conflict),
      };
    })
    .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt));
}

export function renderReviewHistory(trip) {
  const entries = collectReviewHistoryEntries(trip);
  if (entries.length === 0) {
    return "";
  }

  const countLabel = entries.length === 1 ? "1 kept conflict" : `${entries.length} kept conflicts`;
  return `
    <section class="review-history" aria-label="Review history">
      <div class="review-history-header">
        <div>
          <div class="diff-section-title">Review history</div>
          <p>Conflicts that were reviewed and kept as-is.</p>
        </div>
        <span>${escapeHtml(countLabel)}</span>
      </div>
      <ul class="review-history-list">
        ${entries.map(renderReviewHistoryEntry).join("")}
      </ul>
    </section>
  `;
}

function renderReviewHistoryEntry(entry) {
  const locateButton = (entry.dayDate || entry.itemIds.length > 0 || entry.active)
    ? `
      <button
        type="button"
        class="button button-small"
        data-review-action="locate"
        data-conflict-id="${escapeHtml(entry.conflictId)}"
        data-day-date="${escapeHtml(entry.dayDate ?? "")}"
        data-item-id="${escapeHtml(entry.itemIds[0] ?? "")}">
        Locate
      </button>
    `
    : "";
  const reason = entry.reason ? `<p>${escapeHtml(entry.reason)}</p>` : "";
  const stateLabel = entry.active ? "Still active" : "Archived";
  return `
    <li class="review-history-item">
      <div class="review-history-copy">
        <div class="review-history-title">
          <span class="conflict-kept">Kept</span>
          <strong>${escapeHtml(entry.message)}</strong>
        </div>
        <small>
          ${escapeHtml(stateLabel)} · ${escapeHtml(formatConflictType(entry.type))} ·
          ${escapeHtml(formatReviewActor(entry.decidedBy))} · ${escapeHtml(formatDecisionTime(entry.decidedAt))}
        </small>
        ${reason}
      </div>
      <div class="review-history-actions">
        ${locateButton}
        <button
          type="button"
          class="button button-small"
          data-conflict-action="reopen-review"
          data-conflict-id="${escapeHtml(entry.conflictId)}">
          Reopen
        </button>
      </div>
    </li>
  `;
}

function formatReviewActor(value) {
  if (value === "assistant") {
    return "Assistant";
  }

  if (value === "system") {
    return "System";
  }

  return "User";
}

function formatConflictType(value) {
  return String(value ?? "conflict").replaceAll("_", " ");
}

function formatDecisionTime(value) {
  if (!value) {
    return "Time unknown";
  }

  return value.replace("T", " ").slice(0, 16);
}
