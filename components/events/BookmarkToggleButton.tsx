"use client";

import { Bookmark } from "lucide-react";

export function BookmarkToggleButton({
  bookmarked,
  onToggle,
  size = 11,
}: {
  bookmarked: boolean;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      aria-label={bookmarked ? "Remove event from bookmarks" : "Save event to bookmarks"}
      aria-pressed={bookmarked}
      className="flex-shrink-0 rounded p-0.5 outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-blue-400/45"
      style={{
        color: bookmarked ? "rgba(96,165,250,0.95)" : "rgba(85,85,85,0.8)",
        background: bookmarked ? "rgba(59,130,246,0.08)" : "transparent",
        boxShadow: bookmarked ? "0 0 10px rgba(59,130,246,0.12)" : "none",
      }}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.color = "rgba(96,165,250,0.8)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.color = bookmarked
          ? "rgba(96,165,250,0.95)"
          : "rgba(85,85,85,0.8)";
      }}
    >
      <Bookmark size={size} fill={bookmarked ? "currentColor" : "none"} />
    </button>
  );
}
