import {
  calculateSeveritySnapshot,
} from "../kpi/severityDecayHelpers";
import {
  getCorrectiveActionRecommendation,
  getDecisionConfidence,
  getKPILevelByScore,
  getRiskLevelByKPI,
  getSuggestedHRAction,
  getSuggestedHRActionReason,
} from "../kpi/kpiHelpers";

export function buildEmployeeDetailsDecisionSupport(
  incidents = [],
  evaluationDate = new Date()
) {
  const severitySnapshot =
    calculateSeveritySnapshot(
      incidents,
      evaluationDate
    );
  const violationCount =
    severitySnapshot.activeViolationCount;
  const criticalIncidentCount =
    severitySnapshot.activeCriticalIncidentCount;
  const severityScore =
    severitySnapshot.activeSeverityScore;
  const kpiLevel =
    getKPILevelByScore(
      severityScore,
      violationCount
    );
  const riskLevel =
    getRiskLevelByKPI(
      kpiLevel,
      violationCount,
      criticalIncidentCount
    );
  const decisionConfidence =
    getDecisionConfidence({
      violationCount,
      criticalIncidentCount,
      severityScore,
      riskLevel,
    });
  const suggestedHRAction =
    getSuggestedHRAction({
      confidence:
        decisionConfidence,
      violationCount,
      criticalIncidentCount,
      severityScore,
      riskLevel,
      behaviorTrend:
        severitySnapshot.behaviorTrend,
    });
  const correctiveAction =
    getCorrectiveActionRecommendation({
      violationCount,
      criticalIncidentCount,
      severityScore,
      riskLevel,
      kpiLevel,

      /*
       * Researchers' proposed current-intervention policy, pending client
       * review: only incidents with positive current points establish current
       * repetition or keyword patterns. Historical zero-point records remain
       * in the snapshot and audit totals.
       */
      relatedIncidents:
        severitySnapshot.activeIncidents,
    });

  return {
    severitySnapshot,
    kpiLevel,
    riskLevel,
    decisionConfidence,
    suggestedHRAction,
    suggestedHRActionReason:
      getSuggestedHRActionReason({
        suggestedHRAction,
        violationCount,
        criticalIncidentCount,
        severityScore,
        riskLevel,
      }),
    correctiveIntervention:
      correctiveAction.recommendation,
    correctiveInterventionReason:
      correctiveAction.recommendationReason,
  };
}

export function buildCoordinatorAwarenessDecisionSupport(
  incidentSummary
) {
  if (!incidentSummary) {
    return {
      kpiLevel: "Unavailable",
      riskLevel: "Unavailable",
      awarenessMessage: "Unavailable",
      awarenessReason:
        "Incident statistics are unavailable. No recommendation can be generated from incomplete data.",
    };
  }

  const violationCount =
    incidentSummary.activeTotal ??
    incidentSummary.total;
  const criticalIncidentCount =
    incidentSummary.activeCritical ??
    incidentSummary.critical;
  const severityScore =
    incidentSummary.activeSeverityScore ??
    incidentSummary.severityScore;
  const kpiLevel =
    getKPILevelByScore(
      severityScore,
      violationCount
    );
  const riskLevel =
    getRiskLevelByKPI(
      kpiLevel,
      violationCount,
      criticalIncidentCount
    );

  if (incidentSummary.total > 0) {
    return {
      kpiLevel,
      riskLevel,
      awarenessMessage:
        "HR Review Required",
      awarenessReason:
        "The incident indicators include recorded cases from previous and current company assignments. " +
        "This summary is for awareness only. Detailed assessment and any disciplinary action require review " +
        "by authorized HR management.",
    };
  }

  return {
    kpiLevel,
    riskLevel,
    awarenessMessage: "Retain",
    awarenessReason:
      "No recorded incidents were found in the employee's overall incident summary. " +
      "Continue regular HR monitoring.",
  };
}