// Client-safe constants (no zod / node imports) shared by forms, pages and API validation.
export const CATEGORIES = ["bug", "tool", "idea", "other"] as const;
export const STATUSES = ["open", "pending", "resolved", "closed"] as const;
export const ACCENTS = ["teal", "orange", "violet", "green"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];
export type Accent = (typeof ACCENTS)[number];

export const INCIDENT_SEVERITIES = ["info", "minor", "major"] as const;
export const INCIDENT_STATUSES = ["investigating", "identified", "monitoring", "resolved"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
