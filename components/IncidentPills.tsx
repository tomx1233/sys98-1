import { T } from "@/components/LangProvider";

const SEV_CLASS: Record<string, string> = { info: "closed", minor: "pending", major: "down" };
const STATUS_CLASS: Record<string, string> = { investigating: "down", identified: "pending", monitoring: "open", resolved: "resolved" };

export function SeverityPill({ severity }: { severity: string }) {
  const s = (["info", "minor", "major"].includes(severity) ? severity : "minor") as "info" | "minor" | "major";
  return <span className={`pill ${SEV_CLASS[s]}`}><T k={`sev.${s}`} /></span>;
}

export function IncidentStatusPill({ status }: { status: string }) {
  const s = (["investigating", "identified", "monitoring", "resolved"].includes(status) ? status : "investigating") as
    | "investigating" | "identified" | "monitoring" | "resolved";
  return <span className={`pill ${STATUS_CLASS[s]}`}><T k={`inc.${s}`} /></span>;
}
