import { ViewTransition, type ReactNode } from 'react';

/**
 * Unlike the root layout, a template remounts when its route segment changes.
 * That gives React both an outgoing and an incoming page to animate while the
 * background plate remains outside the transition and keeps playing.
 */
export default function RouteTemplate({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter='route-page-enter'
      exit='route-page-exit'
      default='none'
    >
      {children}
    </ViewTransition>
  );
}
