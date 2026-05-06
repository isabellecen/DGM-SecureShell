export type EmailEventStatus = "OK" | "WARN" | "FAIL" | "UNKNOWN";

const zeroCountIssuePattern =
  /\b(?:0|zero|no)\s+(?:errors?|fail(?:ed|ures?)?|warnings?|warn(?:ing)?s?|critical(?:s)?|aborted|cancelled|canceled|skipped|retries|retry|degraded)\b/g;

export function detectEventStatus(text: string): EmailEventStatus {
  const normalized = text.toLowerCase().replace(zeroCountIssuePattern, " ");
  if (/\b(fail(?:ed|ure)?|error|aborted|cancelled|canceled|critical|task error)\b/.test(normalized)) {
    return "FAIL";
  }
  if (/\b(warn(?:ing)?s?|skipped|retry|retries|degraded)\b/.test(normalized)) {
    return "WARN";
  }
  if (/\b(success|successful|completed|ok|finished)\b/.test(normalized)) {
    return "OK";
  }
  return "UNKNOWN";
}
