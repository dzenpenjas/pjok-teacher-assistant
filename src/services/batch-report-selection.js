export function snapshotBatchReportSelection(selection, validSessionIds) {
  return Object.freeze({
    assessmentSessionIds: Object.freeze(
      (Array.isArray(selection?.assessmentSessionIds) ? selection.assessmentSessionIds : [])
        .filter((id) => validSessionIds.has(id))
    ),
    includeGrowth: selection?.includeGrowth === true,
    includeObservations: selection?.includeObservations === true
  });
}
