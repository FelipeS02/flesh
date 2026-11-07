'use client';

import {
  useCallback,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { getImageProps } from 'next/image';
import { MailCheckIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  browserCookieNoticeStorage,
  type CookieNoticeStorage,
} from '@/modules/legal/cookie-notice.storage';
import { decideBanner } from '../domain/banner-policy';
import desktopTexture from './assets/newsletter-banner-desktop.webp';
import mobileTexture from './assets/newsletter-banner-mobile.webp';
import { browserBannerStorage, type BannerStorage } from './banner-storage';
import { createSubscribePort, type SubscribePort } from './newsletter.client';

/** How long the confirmation stays before the banner leaves on its own. */
const SUCCESS_VISIBLE_MS = 4_000;

/**
 * The exit runs on a timer matched to `duration-300`, not on `animationend`:
 * under reduced motion no animation runs, so that event would never fire and
 * the strip would stay mounted forever.
 */
export const BANNER_EXIT_MS = 300;

/**
 * The plate is a full-bleed texture under a strip that is at most ~1600px
 * wide, so one candidate list serves both breakpoints; declared once because
 * the `<picture>` below and the preload must resolve to the SAME candidates
 * or the preload warms a resource nobody requests (see `SheetBackgroundPreload`).
 */
const TEXTURE_SIZES = '100vw';
const DESKTOP_MEDIA = '(min-width: 768px)';
const MOBILE_MEDIA = '(max-width: 767px)';

function textureProps() {
  const common = { alt: '', sizes: TEXTURE_SIZES, fill: true } as const;

  return {
    desktop: getImageProps({ ...common, src: desktopTexture }).props,
    mobile: getImageProps({ ...common, src: mobileTexture }).props,
  };
}

/**
 * Warms both art-directed textures from the document head, each gated by the
 * media query that decides which one the `<picture>` will pick, so a phone
 * never downloads the desktop plate. Low priority: the banner appears ten
 * seconds in, and this must never race the LCP image.
 */
export function NewsletterBannerPreload() {
  const { desktop, mobile } = textureProps();

  return (
    <>
      <link
        rel='preload'
        as='image'
        media={DESKTOP_MEDIA}
        imageSrcSet={desktop.srcSet}
        imageSizes={desktop.sizes}
        fetchPriority='low'
      />
      <link
        rel='preload'
        as='image'
        media={MOBILE_MEDIA}
        imageSrcSet={mobile.srcSet}
        imageSizes={mobile.sizes}
        fetchPriority='low'
      />
    </>
  );
}

type NewsletterBannerProps = {
  /** Injected by the tests; production calls the Server Action. */
  port?: SubscribePort;
  storage?: BannerStorage;
  cookieNotice?: CookieNoticeStorage;
};

type Status =
  | { kind: 'idle'; error: 'invalid-email' | 'unavailable' | null }
  | { kind: 'pending' }
  | { kind: 'done'; email: string };

/**
 * The timed newsletter strip: a NON-modal offer pinned to the bottom edge.
 *
 * No scrim, no scroll lock, not a Dialog, no focus trap, and it never takes
 * focus when it appears — a shopper mid-browse must be able to ignore it
 * completely. That is why it is a labelled `region` and why Escape is handled
 * on the section itself: the key only means "close this" when focus is
 * already inside it.
 *
 * WHEN it shows is `decideBanner`'s job; this component only schedules and
 * draws the answer. It renders nothing until its own timer fires, which is
 * also what keeps the server and the first client render identical.
 */
export function NewsletterBanner({
  port,
  storage,
  cookieNotice,
}: NewsletterBannerProps) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle', error: null });
  const [email, setEmail] = useState('');
  const fieldId = useId();
  const alertId = useId();

  const subscribeToCookieNotice = useCallback(
    (listener: () => void) =>
      (cookieNotice ?? browserCookieNoticeStorage()).subscribe(listener),
    [cookieNotice],
  );
  /**
   * The notice is an external store, read the way the notice itself reads
   * `localStorage`. The server snapshot says "pending" — the safe direction —
   * so nothing can be scheduled from a render that has not seen the real
   * answer yet.
   */
  const cookieNoticePending = useSyncExternalStore(
    subscribeToCookieNotice,
    () => !(cookieNotice ?? browserCookieNoticeStorage()).settled(),
    () => true,
  );

  useEffect(() => {
    const store = storage ?? browserBannerStorage();
    const now = Date.now();
    const decision = decideBanner({
      now,
      sessionStart: store.sessionStart(now),
      dismissedAt: store.dismissedAt(),
      subscribed: store.subscribed(),
      cookieNoticePending,
    });

    if (decision.kind === 'hidden') return;

    // Always through a timer, even when due now: it keeps the state change out
    // of the effect body, and the 0 ms case is the "shortly after the notice
    // is acknowledged" the design asks for.
    const timer = setTimeout(
      () => setOpen(true),
      decision.kind === 'at' ? decision.at - now : 0,
    );

    return () => clearTimeout(timer);
  }, [storage, cookieNoticePending]);

  const done = status.kind === 'done';

  useEffect(() => {
    if (!done) return;

    const timer = setTimeout(() => setLeaving(true), SUCCESS_VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [done]);

  useEffect(() => {
    if (!leaving) return;

    const timer = setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, BANNER_EXIT_MS);

    return () => clearTimeout(timer);
  }, [leaving]);

  if (!open) return null;

  function dismiss() {
    if (leaving) return;
    setLeaving(true);
    (storage ?? browserBannerStorage()).dismiss(Date.now());
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') dismiss();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === 'pending') return;

    setStatus({ kind: 'pending' });
    const outcome = await (port ?? createSubscribePort()).subscribe(email);

    if (outcome.ok) {
      // Written now, not when the banner leaves: a reload inside the four
      // seconds of confirmation must not offer it to someone who just joined.
      (storage ?? browserBannerStorage()).markSubscribed();
      setStatus({ kind: 'done', email });
      return;
    }

    setStatus({ kind: 'idle', error: outcome.error });
  }

  const { desktop, mobile } = textureProps();
  const { srcSet: desktopSrcSet } = desktop;
  const { srcSet: mobileSrcSet, ...mobileImage } = mobile;
  const error = status.kind === 'idle' ? status.error : null;

  return (
    // `isolate` + `overflow-hidden` are the plate's contract (see
    // `SkullsBackdrop`): at -z-1 it paints beneath an opaque parent unless the
    // parent opens a stacking context of its own.
    //
    // `bottom` follows the dock a fixed bar publishes (`useBottomDock`): on a
    // PDP phone the purchase widget owns the bottom edge and this sits on top
    // of it instead of hiding the add-to-cart button. z-40 is the widget's
    // layer; the cookie notice (z-50) can never coexist with it, and a sheet
    // opened over the page (z-50) rightly covers it.
    //
    // While leaving it is `inert`: a strip on its way out must not take a
    // second click or a keystroke. `fill-mode-forwards` holds the last frame so
    // it cannot flash back in before unmounting; under reduced motion there is
    // no slide, so it goes `invisible` at once instead.
    <section
      role='region'
      aria-label='Newsletter'
      data-state={leaving ? 'closed' : 'open'}
      inert={leaving}
      onKeyDown={onKeyDown}
      className={cn(
        'fixed inset-x-0 bottom-[var(--bottom-dock,0px)] z-40 isolate overflow-hidden border-t border-border bg-popover px-5 py-[22px] text-popover-foreground transition-[bottom] duration-300 motion-reduce:transition-none motion-reduce:animate-none md:px-10 md:py-7',
        leaving
          ? 'animate-out fade-out slide-out-to-bottom ease-in fill-mode-forwards motion-reduce:invisible'
          : 'animate-in fade-in slide-in-from-bottom ease-out',
      )}
    >
      <picture>
        <source media={DESKTOP_MEDIA} srcSet={desktopSrcSet} />
        {/* Decorative: the strip reads the same without it. Plain `<img>`
            from `getImageProps` because art direction needs the `<picture>`
            and `next/image` cannot emit one. */}
        <img
          {...mobileImage}
          alt=''
          srcSet={mobileSrcSet}
          aria-hidden
          className='-z-1 object-cover opacity-20'
        />
      </picture>

      <div className='mx-auto flex w-full max-w-[488px] flex-col gap-4'>
        {status.kind === 'done' ? (
          <div role='status' className='flex flex-col gap-3'>
            <h2 className='font-sans text-sm tracking-control text-foreground uppercase'>
              YA ESTÁS ADENTRO
            </h2>
            <p className='flex items-center gap-2 font-sans text-sm text-foreground'>
              <MailCheckIcon aria-hidden className='size-4 shrink-0' />
              {/* No welcome mail goes out before launch (`welcomeEmails`), so
                  this confirms the address instead of promising an inbox. */}
              <span>Te vamos a avisar en {status.email}</span>
            </p>
            <p className='font-sans text-[10px] leading-relaxed tracking-control text-muted-foreground'>
              SOLO DROPS Y RESTOCKS.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className='flex flex-col gap-4'>
            <h2 className='font-sans text-sm tracking-control text-foreground uppercase'>
              ENTERATE PRIMERO DE CADA DROP
            </h2>
            <div className='flex flex-col gap-2'>
              <Label htmlFor={fieldId} className='sr-only'>
                Email
              </Label>
              <Input
                id={fieldId}
                type='email'
                name='email'
                autoComplete='email'
                placeholder='EMAIL'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={error === 'invalid-email' || undefined}
                aria-describedby={error ? alertId : undefined}
                // Primary, not the destructive red: this brand's alarm colour
                // IS its primary, and `aria-invalid:` would otherwise win.
                className='h-11 bg-background/60 px-3 tracking-control aria-invalid:border-primary aria-invalid:ring-primary/20'
              />
              {error && (
                <p
                  id={alertId}
                  role='alert'
                  className='flex items-center gap-2 font-sans text-[11px] tracking-control text-primary'
                >
                  <TriangleAlertIcon
                    aria-hidden
                    className='size-3.5 shrink-0'
                  />
                  {error === 'invalid-email'
                    ? 'REVISÁ EL EMAIL, LE FALTA ALGO.'
                    : 'NO PUDIMOS ANOTARTE. PROBÁ DE NUEVO.'}
                </p>
              )}
            </div>
            <Button
              type='submit'
              disabled={status.kind === 'pending'}
              className='h-11 w-full font-display text-lg'
            >
              {status.kind === 'pending' ? 'Enviando…' : 'Suscribirme'}
            </Button>
            <p className='font-sans text-[10px] leading-relaxed tracking-control text-muted-foreground'>
              AL SUSCRIBIRTE ACEPTÁS RECIBIR COMUNICACIONES COMERCIALES POR EMAIL.
            </p>
          </form>
        )}
      </div>

      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        onClick={dismiss}
        className='absolute top-3 right-3 text-muted-foreground hover:bg-transparent hover:text-foreground'
      >
        <XIcon />
        <span className='sr-only'>Cerrar</span>
      </Button>
    </section>
  );
}
