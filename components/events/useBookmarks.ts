"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { OsintEvent } from "@/types/event";
import type { SocmintReport } from "@/types/socmint";

const STORAGE_KEY = "taipanmonitor.bookmarks";
const EMPTY_BOOKMARK_IDS: string[] = [];
const bookmarkSnapshots = new Map<string, { raw: string | null; ids: string[] }>();
const bookmarkListeners = new Map<string, Set<() => void>>();

function parseStoredBookmarkIds(raw: string | null) {
  if (!raw) return EMPTY_BOOKMARK_IDS;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_BOOKMARK_IDS;
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return EMPTY_BOOKMARK_IDS;
  }
}

function readStoredBookmarkIds(storageKey: string) {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(storageKey);
  const snapshot = bookmarkSnapshots.get(storageKey);
  if (snapshot?.raw === raw) {
    return snapshot.ids;
  }

  const ids = parseStoredBookmarkIds(raw);
  bookmarkSnapshots.set(storageKey, { raw, ids });
  return ids;
}

function subscribeToBookmarkIds(storageKey: string, listener: () => void) {
  const listeners = bookmarkListeners.get(storageKey) ?? new Set<() => void>();
  listeners.add(listener);
  bookmarkListeners.set(storageKey, listeners);

  return () => {
    listeners.delete(listener);
  };
}

function writeStoredBookmarkIds(storageKey: string, ids: string[]) {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(ids);
  window.localStorage.setItem(storageKey, raw);
  bookmarkSnapshots.set(storageKey, { raw, ids });
  bookmarkListeners.get(storageKey)?.forEach((listener) => listener());
}

export function useBookmarkIds(storageKey = STORAGE_KEY) {
  const bookmarkedIds = useSyncExternalStore(
    (listener) => subscribeToBookmarkIds(storageKey, listener),
    () => readStoredBookmarkIds(storageKey),
    () => EMPTY_BOOKMARK_IDS,
  );

  const bookmarkedIdSet = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds]);

  function isBookmarked(eventId: string) {
    return bookmarkedIdSet.has(eventId);
  }

  function toggleBookmark(eventId: string) {
    const current = readStoredBookmarkIds(storageKey);
    const next = current.includes(eventId)
      ? current.filter((id) => id !== eventId)
      : [...current, eventId];

    writeStoredBookmarkIds(storageKey, next);
  }

  function removeBookmark(eventId: string) {
    writeStoredBookmarkIds(
      storageKey,
      readStoredBookmarkIds(storageKey).filter((id) => id !== eventId),
    );
  }

  function clearBookmarks() {
    writeStoredBookmarkIds(storageKey, EMPTY_BOOKMARK_IDS);
  }

  return {
    bookmarkedIds,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    clearBookmarks,
  };
}

export type BookmarkedItem =
  | { type: "event"; event: OsintEvent }
  | { type: "socmint"; report: SocmintReport };

export function useBookmarks(events: OsintEvent[], reports: SocmintReport[] = []) {
  const { bookmarkedIds, isBookmarked, toggleBookmark, removeBookmark, clearBookmarks } =
    useBookmarkIds();
  const bookmarkedIdSet = useMemo(() => new Set(bookmarkedIds), [bookmarkedIds]);
  const bookmarkedEvents = useMemo(
    () => events.filter((event) => bookmarkedIdSet.has(event.id)),
    [bookmarkedIdSet, events],
  );
  const bookmarkedItems = useMemo<BookmarkedItem[]>(
    () => [
      ...events
        .filter((event) => bookmarkedIdSet.has(event.id))
        .map((event) => ({ type: "event" as const, event })),
      ...reports
        .filter((report) => bookmarkedIdSet.has(report.id))
        .map((report) => ({ type: "socmint" as const, report })),
    ],
    [bookmarkedIdSet, events, reports],
  );

  return {
    bookmarkedIds,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    clearBookmarks,
    bookmarkedEvents,
    bookmarkedItems,
  };
}
