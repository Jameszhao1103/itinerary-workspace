export function classifyConflict(conflict) {
  if (
    conflict.severity === "error" ||
    conflict.type === "locked_item_violation" ||
    conflict.type === "overlap_conflict" ||
    conflict.type === "travel_time_underestimated"
  ) {
    return {
      level: "must-fix",
      label: "Must fix",
      rank: 0,
    };
  }

  if (
    conflict.severity === "warning" ||
    conflict.type === "opening_hours_conflict" ||
    conflict.type === "meal_window_missing" ||
    conflict.type === "pace_limit_exceeded" ||
    conflict.type === "reservation_time_mismatch"
  ) {
    return {
      level: "review",
      label: "Review",
      rank: 1,
    };
  }

  return {
    level: "fyi",
    label: "FYI",
    rank: 2,
  };
}

export function filterConflictsForView(conflicts, filter) {
  const normalizedFilter = normalizeConflictFilter(filter);
  if (normalizedFilter === "all") {
    return conflicts;
  }

  return conflicts.filter((conflict) => classifyConflict(conflict).level === normalizedFilter);
}

export function countConflictGrades(conflicts) {
  return conflicts.reduce((counts, conflict) => {
    const level = classifyConflict(conflict).level;
    if (level === "must-fix") {
      counts["must-fix"] += 1;
    } else if (level === "review") {
      counts.review += 1;
    }
    return counts;
  }, { "must-fix": 0, review: 0 });
}

export function normalizeConflictFilter(value) {
  return value === "must-fix" || value === "review" ? value : "all";
}

export function conflictFilterLabel(filter) {
  if (filter === "must-fix") {
    return "Must fix";
  }

  if (filter === "review") {
    return "Review";
  }

  return "All";
}
