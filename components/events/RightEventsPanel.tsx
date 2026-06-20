"use client";
import { useEffect, useRef } from "react";
import { OsintEvent } from "@/types/event";
import { EventCard } from "./EventCard";

interface RightEventsPanelProps {
  events: OsintEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isBookmarked: (eventId: string) => boolean;
  onToggleBookmark: (eventId: string) => void;
}

export function RightEventsPanel({
  events,
  selectedId,
  onSelect,
  isBookmarked,
  onToggleBookmark,
}: RightEventsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // When selectedId changes (e.g. from a globe marker click) scroll that
  // card into view.  Uses a data attribute so no DOM tree knowledge is needed.
  useEffect(() => {
    if (!selectedId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(
      `[data-event-id="${selectedId}"]`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  return (
    <div
      className="flex h-full max-h-full min-h-0 flex-shrink-0 flex-col overflow-hidden rounded-[10px]"
      style={{
        width: "100%",
        background: "var(--bg-panel)",
        border: "1px solid var(--c-border-1)",
        boxShadow: "var(--shadow-inset-highlight), 0 14px 40px rgba(0,0,0,0.4)",
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--c-border-2)" }}
      >
        <span
          className="font-semibold tracking-widest uppercase"
          style={{ fontSize: "10px", color: "var(--c-t4)" }}
        >
          Active Events
        </span>
        <span style={{ fontSize: "10.5px", color: "var(--c-t5)" }}>
          {events.length} Results
        </span>
      </div>

      {/* Scrollable card list */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" }}
      >
        {events.map((event, i) => (
          <div key={event.id} data-event-id={event.id}>
            <EventCard
              event={event}
              index={i + 1}
              selected={selectedId === event.id}
              onClick={() => onSelect(event.id)}
              bookmarked={isBookmarked(event.id)}
              onToggleBookmark={onToggleBookmark}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
