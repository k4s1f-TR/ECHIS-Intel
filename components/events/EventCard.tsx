"use client";
import { Clock, MapPin } from "lucide-react";
import { OsintEvent } from "@/types/event";
import { BookmarkToggleButton } from "./BookmarkToggleButton";

interface EventCardProps {
  event: OsintEvent;
  index: number;
  selected: boolean;
  onClick?: () => void;
  bookmarked?: boolean;
  onToggleBookmark?: (eventId: string) => void;
}

export function EventCard({
  event,
  index,
  selected,
  onClick,
  bookmarked = false,
  onToggleBookmark,
}: EventCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-lg transition-all duration-150 ${onClick ? "cursor-pointer" : ""}`}
      style={{
        padding: "10px 11px",
        border: selected
          ? "1px solid var(--c-accent-border)"
          : "1px solid var(--c-border-3)",
        background: selected
          ? "linear-gradient(180deg, rgba(255,43,61,0.17), rgba(255,43,61,0.05))"
          : "var(--c-card-bg)",
        boxShadow: selected
          ? "0 0 0 1px var(--c-accent-bg-soft), 0 10px 28px rgba(0,0,0,0.35)"
          : "none",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.background =
            "var(--c-card-bg-hover)";
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--c-border-1)";
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLElement).style.background =
            "var(--c-card-bg)";
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--c-border-3)";
        }
      }}
    >
      {/* Header row: index + title + bookmark */}
      <div className="flex items-start gap-2 mb-1.5">
        <span
          className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center mt-px"
          style={{
            fontSize: "9px",
            fontWeight: 700,
            background: selected
              ? "var(--accent-blue-text)"
              : "rgba(255,255,255,0.07)",
            color: selected ? "#fff" : "var(--c-t5)",
          }}
        >
          {index}
        </span>
        <p
          className="flex-1 leading-snug font-medium pr-1"
          style={{
            fontFamily: "var(--font-disp)",
            fontSize: "var(--c-fs-md)",
            color: selected
              ? "rgba(238,240,244,0.98)"
              : "var(--c-t3)",
          }}
        >
          {event.title}
        </p>
        <div className="mt-0.5">
          <BookmarkToggleButton
            bookmarked={bookmarked}
            onToggle={() => onToggleBookmark?.(event.id)}
          />
        </div>
      </div>

      {/* Meta: time + location */}
      <div
        className="flex items-center gap-3 mb-1.5"
        style={{ fontSize: "10.5px", color: "var(--c-t5)" }}
      >
        <span className="flex items-center gap-1">
          <Clock size={9} style={{ color: "rgba(85,85,85,0.7)" }} />
          {event.time}
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={9} style={{ color: "rgba(85,85,85,0.7)" }} />
          {event.location}
        </span>
      </div>

      {/* Summary */}
      <p
        className="leading-relaxed line-clamp-2"
        style={{ fontSize: "11.5px", color: "var(--c-t5)" }}
      >
        {event.summary}
      </p>
    </div>
  );
}
