"use client";

import { useEffect, type RefObject } from "react";

/**
 * The CSS custom property a fixed bar publishes on `<html>`: the pixel height
 * of whatever is currently pinned to the bottom edge of the screen.
 *
 * Anything else that must sit ABOVE that bar (the newsletter banner above the
 * PDP's purchase widget) positions itself with
 * `bottom: var(--bottom-dock, 0px)`. It is a CSS variable and not React state
 * because publisher and consumer live in different subtrees with no common
 * ancestor, and the value is only ever used as a length.
 *
 * One dock at a time: a second publisher would overwrite the first. Today
 * only the PDP's mobile purchase widget publishes.
 */
export const BOTTOM_DOCK_PROPERTY = "--bottom-dock";

/**
 * Publishes `ref`'s height as `--bottom-dock` while `active`, and clears it
 * the moment the element stops being a dock (hidden or unmounted).
 *
 * `active` exists because the widget stays mounted while it is slid off
 * screen: its box still has a height then, but nothing is covering the
 * bottom edge, so it must not push anything up.
 *
 * `offsetHeight` (border box) and not the observer entry's content box: the
 * padding is part of what covers the page.
 */
export function useBottomDock(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const element = ref.current;
    if (!active || !element) return;

    const root = document.documentElement;
    const publish = () => root.style.setProperty(BOTTOM_DOCK_PROPERTY, `${element.offsetHeight}px`);

    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(element);

    return () => {
      observer.disconnect();
      root.style.removeProperty(BOTTOM_DOCK_PROPERTY);
    };
  }, [ref, active]);
}
