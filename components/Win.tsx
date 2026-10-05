"use client";

import { useState } from "react";

/** A window with a title bar, like everywhere else on the site. Double-click the bar or use the arrow to collapse it. */
export function Win({
  title,
  children,
  id,
  className = "",
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section id={id} className={`win boot${collapsed ? " collapsed" : ""} ${className}`.trim()}>
      <div
        className="titlebar"
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest(".collapse")) setCollapsed((c) => !c);
        }}
      >
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <span className="title">{title}</span>
        <button
          className="collapse"
          type="button"
          aria-expanded={!collapsed}
          title={collapsed ? "expand" : "collapse"}
          onClick={() => setCollapsed((c) => !c)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      <div className="win-body-wrap">
        <div className="win-body-inner">{children}</div>
      </div>
    </section>
  );
}
