"use client";

import { useState } from "react";

export function ApprovalCard({
  grievanceId,
  subject,
  body,
  onDecision,
}: {
  grievanceId: string;
  subject: string;
  body: string;
  onDecision?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [edits, setEdits] = useState("");

  async function submit(action: "approve" | "edit" | "cancel") {
    setBusy(action);
    try {
      await fetch(`/api/grievances/${grievanceId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "edit" ? { action, edits } : { action }),
      });
      onDecision?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border border-[#B8954E]/60 bg-[var(--surface)] p-4">
      <p className="mono text-[10px] uppercase text-[#B8954E]">Approval pending</p>
      <h3 className="serif mt-2 text-xl text-[var(--text-primary)]">{subject}</h3>
      <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap border border-[var(--border)] bg-[#0F0E0C] p-4 font-sans text-sm leading-6 text-[var(--text-primary)]">
        {body}
      </pre>
      <textarea
        className="mt-3 min-h-20 w-full border border-[var(--border)] bg-[#0F0E0C] p-3 text-sm text-[var(--text-primary)] outline-none focus:border-[#B8954E]"
        onChange={(event) => setEdits(event.target.value)}
        placeholder="Edits for the revised draft"
        value={edits}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="border border-[#7F9A68] px-3 py-2 text-sm text-[#9FB88E] disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => submit("approve")}
          type="button"
        >
          {busy === "approve" ? "Approving" : "Approve & Send"}
        </button>
        <button
          className="border border-[#B8954E] px-3 py-2 text-sm text-[#D9BE7B] disabled:opacity-50"
          disabled={busy !== null || edits.trim().length === 0}
          onClick={() => submit("edit")}
          type="button"
        >
          {busy === "edit" ? "Submitting" : "Edit"}
        </button>
        <button
          className="border border-[#C03022] px-3 py-2 text-sm text-[#DF6A5F] disabled:opacity-50"
          disabled={busy !== null}
          onClick={() => submit("cancel")}
          type="button"
        >
          {busy === "cancel" ? "Cancelling" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
