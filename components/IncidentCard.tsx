import { T } from "@/components/LangProvider";
import { Time } from "@/components/Time";
import { SeverityPill, IncidentStatusPill } from "@/components/IncidentPills";

export interface IncidentView {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  updates: { id: string; status: string; body: string; createdAt: string; author: string }[];
}

/** One incident with its timeline, newest update first. Used on the public page and in the dashboard. */
export function IncidentCard({ inc, children }: { inc: IncidentView; children?: React.ReactNode }) {
  const updates = [...inc.updates].reverse();
  return (
    <article className={`incident sev-${inc.severity}`}>
      <header className="incident-head">
        <h3>{inc.title}</h3>
        <div className="row-gap wrap-row">
          <SeverityPill severity={inc.severity} />
          <IncidentStatusPill status={inc.status} />
        </div>
      </header>
      <ol className="incident-timeline">
        {updates.map((u) => (
          <li key={u.id}>
            <div className="incident-meta">
              <IncidentStatusPill status={u.status} />
              <Time iso={u.createdAt} mode="full" />
              <span className="muted"><T k="inc.by" /> {u.author}</span>
            </div>
            <p>{u.body}</p>
          </li>
        ))}
      </ol>
      {children}
    </article>
  );
}
