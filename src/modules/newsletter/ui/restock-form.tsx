'use client';

import { useId, useState, type FormEvent } from 'react';
import { MailCheckIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createRestockPort, type RestockPort } from './newsletter.client';

type RestockFormProps = {
  productId: number;
  variantId: number;
  /** "NEGRO · M": read back inside the confirmation sentences. */
  variantLine: string;
  /**
   * `panel` is the desktop card with its own title; `sheet` is the stacked
   * body for the mobile bottom sheet, whose header already carries the title
   * and the pitch.
   */
  layout?: 'panel' | 'sheet';
  /** Injected by the tests; production calls the Server Action. */
  port?: RestockPort;
};

type Status =
  | { kind: 'idle'; error: 'invalid-email' | 'unavailable' | null }
  | { kind: 'pending' }
  | { kind: 'done'; result: 'created' | 'already-requested'; email: string };

const ERROR_COPY = {
  'invalid-email': 'Revisá el email, le falta algo.',
  unavailable: 'No pudimos anotarte. Probá de nuevo.',
} as const;

/**
 * Shared with the mobile sheet's description, so both surfaces make the same
 * promise. It sells the alert instead of naming the variant: the size is
 * already lit on the selector right above, and repeated here it rendered as a
 * lone "M" too small to read as anything.
 */
export const RESTOCK_PITCH =
  'Enterate primero que nadie cuando vuelva a estar disponible.';

const DONE_TITLE = {
  created: 'Te avisamos',
  'already-requested': 'Ya estás anotado',
} as const;

/**
 * "Avisame cuando vuelva": the per-variant restock request.
 *
 * It holds no variant state of its own beyond what was typed — the PDP keys
 * it by variant id, so choosing another size throws this away and starts
 * clean. A confirmation that stayed up after the shopper picked a different
 * size would claim an alert for a garment they are no longer looking at.
 *
 * The newsletter box starts UNCHECKED and is sent as-is: consent has to be an
 * act, and a restock request on its own never enters the subscriber list.
 */
export function RestockForm({
  productId,
  variantId,
  variantLine,
  layout = 'panel',
  port,
}: RestockFormProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle', error: null });
  const [email, setEmail] = useState('');
  const [newsletter, setNewsletter] = useState(false);
  const fieldId = useId();
  const alertId = useId();
  const checkboxId = useId();
  const sheet = layout === 'sheet';
  const error = status.kind === 'idle' ? status.error : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === 'pending') return;

    setStatus({ kind: 'pending' });
    const outcome = await (port ?? createRestockPort()).request({
      email,
      productId,
      variantId,
      newsletter,
    });

    setStatus(
      outcome.ok
        ? { kind: 'done', result: outcome.status, email }
        : { kind: 'idle', error: outcome.error },
    );
  }

  const body =
    status.kind === 'done' ? (
      <div role='status' className='flex flex-col gap-3'>
        <h3 className='font-display text-[34px] leading-none text-foreground'>
          {DONE_TITLE[status.result]}
        </h3>
        <p className='flex items-start gap-3 border-l-2 border-foreground py-1 pl-3 font-sans text-sm text-foreground'>
          <MailCheckIcon aria-hidden className='mt-0.5 size-4 shrink-0' />
          <span>
            {status.result === 'created'
              ? `Cuando entre ${variantLine} te escribimos a ${status.email}.`
              : `${status.email} ya espera ${variantLine}. Te escribimos apenas entre.`}
          </span>
        </p>
        <Button
          type='button'
          variant='link'
          onClick={() => {
            setEmail('');
            setStatus({ kind: 'idle', error: null });
          }}
          className='h-auto self-start p-0 font-sans text-xs tracking-control text-foreground'
        >
          USAR OTRO EMAIL
        </Button>
      </div>
    ) : (
      <form onSubmit={onSubmit} noValidate className='flex flex-col gap-4'>
        {!sheet && (
          <div className='flex flex-col gap-2'>
            <h3 className='font-display text-[34px] leading-none text-foreground'>
              Avisame cuando vuelva
            </h3>
            <p className='font-sans text-sm leading-snug text-muted-foreground'>
              {RESTOCK_PITCH}
            </p>
          </div>
        )}

        <div className='flex flex-col gap-2'>
          <Label
            htmlFor={fieldId}
            className={sheet ? 'font-sans text-xs tracking-control' : 'sr-only'}
          >
            {sheet ? 'EMAIL' : 'Email'}
          </Label>
          <div className={cn('flex gap-2', sheet && 'flex-col')}>
            <Input
              id={fieldId}
              type='email'
              name='email'
              autoComplete='email'
              placeholder='tu@email.com'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={error === 'invalid-email' || undefined}
              aria-describedby={error ? alertId : undefined}
              // The brand's alarm colour is its primary, not the registry's
              // destructive red.
              // `flex-1` only in the panel's row: in the sheet's column it is
              // flex-basis 0 on the vertical axis and crushed the field to ~26px.
              className={cn(
                'h-11 bg-background/60 px-3 aria-invalid:border-primary aria-invalid:ring-primary/20',
                !sheet && 'flex-1',
              )}
            />
            <Button
              type='submit'
              disabled={status.kind === 'pending'}
              className={cn(
                'h-11 font-display text-lg',
                sheet ? 'w-full' : 'shrink-0 px-6',
              )}
            >
              {status.kind === 'pending' ? 'Enviando…' : 'Avisame'}
            </Button>
          </div>
          {error && (
            <p
              id={alertId}
              role='alert'
              className='flex items-center gap-2 font-sans text-xs text-primary'
            >
              <TriangleAlertIcon aria-hidden className='size-3.5 shrink-0' />
              {ERROR_COPY[error]}
            </p>
          )}
        </div>

        <Label
          htmlFor={checkboxId}
          className='items-start gap-3 font-sans text-xs leading-snug font-normal text-foreground'
        >
          <Checkbox
            id={checkboxId}
            checked={newsletter}
            onCheckedChange={(checked) => setNewsletter(checked)}
          />
          <span>Quiero recibir novedades y lanzamientos de FLESH.</span>
        </Label>
      </form>
    );

  if (sheet) {
    // The sheet supplies the surface, so there is no card here; the heading
    // only appears for the confirmation, which replaces the sheet's own body.
    return body;
  }

  return (
    <div className='flex flex-col gap-4 border border-border bg-white/[0.02] p-6'>
      {body}
    </div>
  );
}
