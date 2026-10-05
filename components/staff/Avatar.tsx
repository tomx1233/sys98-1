import { initials } from "@/lib/utils";

/** Profile picture if there is one, otherwise the same mono initials box the site uses for "98". */
export function Avatar({
  name,
  url,
  accent = "teal",
  size = "md",
}: {
  name: string;
  url?: string | null;
  accent?: string;
  size?: "md" | "lg";
}) {
  return (
    <span className={`avatar avatar-${size}`} data-accent={accent} aria-hidden="true">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
