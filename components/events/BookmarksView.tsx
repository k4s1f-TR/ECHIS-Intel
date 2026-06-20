"use client";

import { Bookmark } from "lucide-react";
import {
  SOCMINT_PLATFORM_LABELS,
  SOCMINT_STATUS_LABELS,
  SOCMINT_TYPE_BADGE_LABELS,
} from "@/types/socmint";
import { EventCard } from "./EventCard";
import { BookmarkToggleButton } from "./BookmarkToggleButton";
import type { BookmarkedItem } from "./useBookmarks";

const SOCMINT_STATUS_COLORS = {
  unverified: "rgba(248,113,113,0.9)",
  reported: "rgba(251,191,36,0.9)",
  corroborated: "var(--c-elev)",
  "needs-review": "rgba(150,170,196,0.9)",
} as const;

export function BookmarksView({
  items,
  onRemoveBookmark,
  onClearBookmarks,
}: {
  items: BookmarkedItem[];
  onRemoveBookmark: (eventId: string) => void;
  onClearBookmarks: () => void;
}) {
  const hasBookmarks = items.length > 0;

  return (
    <main
      className="flex min-h-0 flex-1 overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 24% 18%, rgba(255,43,61,0.035), rgba(10,10,10,0) 32%), var(--c-bg-base)",
      }}
    >
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-col gap-3 px-6 py-4">
        <section className="flex flex-shrink-0 items-start gap-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Bookmark size={15} style={{ color: "var(--accent-blue-text)" }} />
              <span
                className="font-semibold uppercase"
                style={{ color: "rgba(147,147,147,0.82)", fontSize: "10.5px", letterSpacing: "0.12em" }}
              >
                Saved Events
              </span>
            </div>
            <h1 className="font-semibold" style={{ color: "rgba(235,235,235,0.95)", fontSize: "22px" }}>
              Bookmarks
            </h1>
          </div>
        </section>

        <section
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px]"
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--c-border-1)",
            boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.035)",
          }}
        >
          <div
            className="flex flex-shrink-0 items-center justify-between px-4 py-2.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.055)" }}
          >
            <span
              className="font-semibold uppercase"
              style={{ color: "rgba(170,170,170,0.8)", fontSize: "10px", letterSpacing: "0.12em" }}
            >
              Bookmarked Events
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!hasBookmarks}
                onClick={onClearBookmarks}
                className="rounded-md px-2.5 py-1 font-semibold uppercase outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-[#ec2f3b]/45"
                style={{
                  background: hasBookmarks ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.018)",
                  border: "1px solid rgba(255,255,255,0.065)",
                  color: hasBookmarks ? "rgba(150,165,185,0.86)" : "rgba(80,80,80,0.72)",
                  cursor: hasBookmarks ? "pointer" : "default",
                  fontSize: "9.5px",
                  letterSpacing: "0.08em",
                }}
              >
                Clear
              </button>
              <span
                className="rounded-md px-2.5 py-1 font-semibold"
                style={{
                  background: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.065)",
                  color: "rgba(145,155,170,0.86)",
                  fontSize: "10.5px",
                }}
              >
                {items.length} Saved
              </span>
            </div>
          </div>

          {items.length === 0 ? (
            <div
              className="flex flex-1 items-center justify-center text-center"
              style={{ color: "rgba(105,105,105,0.9)", fontSize: "12px" }}
            >
              No bookmarked events yet.
            </div>
          ) : (
            <div
              className="tm-scrollbar politics-feed-scrollbar grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-3 lg:grid-cols-2"
            >
              {items.map((item, index) =>
                item.type === "event" ? (
                  <EventCard
                    key={item.event.id}
                    event={item.event}
                    index={index + 1}
                    selected={false}
                    bookmarked
                    onToggleBookmark={onRemoveBookmark}
                  />
                ) : (
                  <article
                    key={item.report.id}
                    className="relative rounded-lg transition-all duration-150"
                    style={{
                      padding: "10px 11px",
                      border: "1px solid rgba(255,255,255,0.055)",
                      background: "rgba(255,255,255,0.018)",
                    }}
                  >
                    <div className="mb-1.5 flex items-start gap-2">
                      <span
                        className="mt-px flex h-4 w-4 flex-shrink-0 items-center justify-center rounded"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          background: "rgba(255,255,255,0.07)",
                          color: "var(--c-t5)",
                        }}
                      >
                        {index + 1}
                      </span>
                      <p
                        className="flex-1 pr-1 font-medium leading-snug"
                        style={{ fontSize: "12.5px", color: "var(--c-t3)" }}
                      >
                        {item.report.title}
                      </p>
                      <div className="mt-0.5">
                        <BookmarkToggleButton
                          bookmarked
                          onToggle={() => onRemoveBookmark(item.report.id)}
                        />
                      </div>
                    </div>

                    <div
                      className="mb-1.5 flex items-center gap-2"
                      style={{ fontSize: "10.5px", color: "rgba(100,100,100,0.9)" }}
                    >
                      <span>{item.report.timestamp}</span>
                      <span>{item.report.locationName}</span>
                    </div>

                    <div className="mb-1.5 flex flex-wrap gap-1">
                      <span
                        className="rounded px-1.5 py-0.5 uppercase tracking-wide"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          background: "var(--accent-blue-bg)",
                          color: "var(--accent-blue-text)",
                        }}
                      >
                        SOCMINT
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 uppercase tracking-wide"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          background: "rgba(255,255,255,0.045)",
                          color: "rgba(150,165,185,0.9)",
                        }}
                      >
                        {SOCMINT_PLATFORM_LABELS[item.report.platform]}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 uppercase tracking-wide"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          background: "rgba(255,255,255,0.045)",
                          color: "rgba(150,165,185,0.9)",
                        }}
                      >
                        {SOCMINT_TYPE_BADGE_LABELS[item.report.type]}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 uppercase tracking-wide"
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          background: "rgba(255,255,255,0.045)",
                          color: SOCMINT_STATUS_COLORS[item.report.status],
                        }}
                      >
                        {SOCMINT_STATUS_LABELS[item.report.status]}
                      </span>
                    </div>

                    <p
                      className="line-clamp-2 leading-relaxed"
                      style={{ fontSize: "11.5px", color: "rgba(110,110,110,0.9)" }}
                    >
                      {item.report.summary}
                    </p>
                  </article>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
