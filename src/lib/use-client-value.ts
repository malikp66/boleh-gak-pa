"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Baca nilai yang hanya ada di browser (localStorage, fitur browser) tanpa hydration mismatch. */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noop, read, () => serverValue);
}
