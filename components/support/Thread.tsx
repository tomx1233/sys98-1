import { T } from "@/components/LangProvider";
import { Time } from "@/components/Time";

export interface ThreadMessage {
  id: string;
  fromStaff: boolean;
  author: string;
  body: string;
  createdAt: string; // ISO
}

export function Thread({ messages }: { messages: ThreadMessage[] }) {
  return (
    <div className="thread">
      {messages.map((m) => (
        <div key={m.id} className={`msg${m.fromStaff ? " staff" : ""}`}>
          <div className="msg-meta">
            <b>{m.author}</b>
            {m.fromStaff && (
              <span className="app-tag" style={{ marginTop: 0 }}>
                <T k="thread.team" />
              </span>
            )}
            <Time iso={m.createdAt} mode="full" />
          </div>
          <div className="msg-body">{m.body}</div>
        </div>
      ))}
    </div>
  );
}
