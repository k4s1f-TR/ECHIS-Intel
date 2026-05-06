"use client";
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
  return (
    <div
      className="flex h-full max-h-full min-h-0 flex-shrink-0 flex-col overflow-hidden rounded-[10px]"
      style={{
        width: "100%",
        background: "rgba(12,12,12,0.97)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <span
          className="font-semibold tracking-widest uppercase"
          style={{ fontSize: "10px", color: "rgba(170,170,170,0.8)" }}
        >
          Active Events
        </span>
        <span style={{ fontSize: "10.5px", color: "rgba(100,100,100,0.85)" }}>
          {events.length} Results
        </span>
      </div>

      {/* Scrollable card list */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px" }}
      >
        {events.map((event, i) => (
          <EventCard
            key={event.id}
            event={event}
            index={i + 1}
            selected={selectedId === event.id}
            onClick={() => onSelect(event.id)}
            bookmarked={isBookmarked(event.id)}
            onToggleBookmark={onToggleBookmark}
          />
        ))}
      </div>
    </div>
  );
}
