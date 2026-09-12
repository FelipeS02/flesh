/**
 * When the fixed purchase widget is still worth showing.
 *
 * The widget is a shortcut sitting OVER the real controls, which exist
 * further down the same page. Once those controls are genuinely on their way
 * into view there is no shortcut left to offer — two live copies of the same
 * size boxes on one screen is a question ("which of these is the real one?"),
 * not a convenience.
 *
 * "On their way into view" is the panel's TOP EDGE crossing the middle of the
 * viewport. The midpoint rather than the top edge because a widget that
 * vanished the instant the panel appeared would flicker on every small scroll
 * near the boundary; by the halfway mark the panel owns the screen.
 *
 * Pure, and separate from the observer that feeds it, because this is the
 * only part of the rule worth proving — jsdom has no layout, so an assertion
 * about an IntersectionObserver here would be testing a stub.
 */
export function widgetVisible(panelTop: number, viewportHeight: number): boolean {
  return panelTop > viewportHeight / 2;
}
