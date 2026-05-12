"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export default function ChatPanel({
  bookingId,
  viewerId,
}: {
  bookingId: string;
  viewerId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/chat/${bookingId}/messages`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      // swallow
    }
  }

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/chat/${bookingId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to send");
      setSending(false);
      return;
    }
    setDraft("");
    setSending(false);
    fetchMessages();
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-lg border bg-white">
      <div ref={scrollerRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet. Say hi.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === viewerId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    mine ? "bg-brand text-white" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div
                    className={`mt-0.5 text-[10px] ${
                      mine ? "text-white/70" : "text-slate-500"
                    }`}
                  >
                    {new Date(m.createdAt).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="rounded bg-brand px-4 py-2 text-sm text-white hover:bg-brand-dark disabled:opacity-60"
        >
          Send
        </button>
      </form>
      {error && <div className="px-4 pb-2 text-xs text-red-600">{error}</div>}
    </div>
  );
}
