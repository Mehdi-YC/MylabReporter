import type { Alert } from './anomalies';

export interface RankedAlert {
	alert: Alert;
	/** Id of the alert this one is grouped under (same patients), if any. */
	linkedTo: string | null;
}

const SEVERITY = { critical: 0, warning: 1 };

/**
 * System-1 triage order: critical before warning, strongest signal first. A resistance rise or
 * surge whose cases are mostly the same isolates as a phenotype cluster or sentinel in the same
 * ward is one event seen twice: it is placed right under that alert instead of competing with it.
 */
export function rankAlerts(alerts: Alert[], minOverlap = 0.5): RankedAlert[] {
	const byPriority = [...alerts].sort(
		(a, b) => SEVERITY[a.severity] - SEVERITY[b.severity] || a.pValue - b.pValue
	);
	const anchors = byPriority.filter((a) => a.kind === 'phenotype-cluster' || a.kind === 'sentinel');
	const caseIds = new Map(anchors.map((a) => [a.id, new Set(a.cases.map((c) => c.isolateId))]));

	const parentOf = new Map<string, string>();
	for (const a of byPriority) {
		if (a.kind === 'phenotype-cluster' || a.kind === 'sentinel' || !a.cases.length) continue;
		for (const anchor of anchors) {
			if (anchor.ward !== a.ward) continue;
			const ids = caseIds.get(anchor.id)!;
			const shared = a.cases.filter((c) => ids.has(c.isolateId)).length;
			if (shared / a.cases.length >= minOverlap) {
				parentOf.set(a.id, anchor.id);
				break;
			}
		}
	}

	const out: RankedAlert[] = [];
	for (const a of byPriority) {
		if (parentOf.has(a.id)) continue;
		out.push({ alert: a, linkedTo: null });
		for (const child of byPriority)
			if (parentOf.get(child.id) === a.id) out.push({ alert: child, linkedTo: a.id });
	}
	return out;
}
