import { T } from "@/components/LangProvider";
import type { Status } from "@/lib/constants";

export function StatusPill({ status }: { status: string }) {
  const s = (["open", "pending", "resolved", "closed"].includes(status) ? status : "open") as Status;
  return (
    <span className={`pill ${s}`}>
      <T k={`status.${s}`} />
    </span>
  );
}

export function CategoryTag({ category }: { category: string }) {
  const c = (["bug", "tool", "idea", "other"].includes(category) ? category : "other") as "bug" | "tool" | "idea" | "other";
  return (
    <span className="app-tag" style={{ marginTop: 0 }}>
      <T k={`cat.${c}`} />
    </span>
  );
}
