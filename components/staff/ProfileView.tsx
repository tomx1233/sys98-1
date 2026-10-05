import { T } from "@/components/LangProvider";
import { Time } from "@/components/Time";
import { Avatar } from "@/components/staff/Avatar";
import { hostOf } from "@/lib/utils";

export interface ProfileData {
  username: string;
  role: string;
  displayName: string;
  title: string;
  bio: string;
  languages: string;
  avatarUrl: string | null;
  accent: string;
  links: { label: string; url: string }[];
  joinedAt: string; // ISO
  viewCount?: number;
}

/** The public staff page. The dashboard editor renders the very same component as its live preview. */
export function ProfileView({ p, preview = false }: { p: ProfileData; preview?: boolean }) {
  const name = p.displayName || p.username;
  return (
    <div className="profile" data-accent={p.accent}>
      <div className="pf-head">
        <Avatar name={name} url={p.avatarUrl} accent={p.accent} size="lg" />
        <div className="pf-name">
          <h1>{name}</h1>
          <div className="pf-line">
            <span className="mono muted">@{p.username}</span>
            {p.title && <span className="app-tag pf-title">{p.title}</span>}
            {p.role === "owner" && <span className="app-tag"><T k="profile.owner" /></span>}
          </div>
        </div>
      </div>

      <div className="pf-body">
        {p.bio ? <p className="pf-bio">{p.bio}</p> : <p className="pf-bio muted"><T k="profile.noBio" /></p>}

        <dl className="pf-facts">
          {p.languages && (
            <div>
              <dt><T k="profile.speaks" /></dt>
              <dd>{p.languages}</dd>
            </div>
          )}
          <div>
            <dt><T k="profile.since" /></dt>
            <dd><Time iso={p.joinedAt} mode="date" /></dd>
          </div>
          {p.viewCount !== undefined && (
            <div>
              <dt><T k="profile.views" /></dt>
              <dd>{p.viewCount}</dd>
            </div>
          )}
        </dl>

        {p.links.length > 0 && (
          <div className="pf-links">
            {p.links.map((l, i) => (
              <a key={i} href={preview ? undefined : l.url} target="_blank" rel="noopener noreferrer nofollow" className="pf-link">
                <span>{l.label}</span>
                <span className="mono muted">{hostOf(l.url)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
