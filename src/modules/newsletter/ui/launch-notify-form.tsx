'use client';

import { useId, useState, type FormEvent } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createLaunchPort, type LaunchPort } from './newsletter.client';

type LaunchNotifyFormProps = {
  productId: number;
  /** Injected by the tests; production calls the Server Action. */
  port?: LaunchPort;
};

type Status =
  | { kind: 'idle'; error: 'invalid-email' | 'unavailable' | null }
  | { kind: 'pending' }
  | { kind: 'done' };

// Same words as `RestockForm`: both forms fail the same two ways and the
// shopper should read one voice.
const ERROR_COPY = {
  'invalid-email': 'Revisá el email, le falta algo.',
  unavailable: 'No pudimos anotarte. Probá de nuevo.',
} as const;

const DONE_COPY = 'Listo. Te escribimos el día que salga.';

/**
 * "Avisame" on a preview PDP: one email, the day the product goes on sale.
 *
 * Both outcomes of a stored request ("created" and "already-requested") read
 * the same here: the promise is identical, and telling a stranger's address
 * apart from a fresh one would only reveal who already asked.
 *
 * There is no consent box: the shopper asked for a single message, and this
 * request never joins the newsletter list.
 */
export function LaunchNotifyForm({ productId, port }: LaunchNotifyFormProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle', error: null });
  const [email, setEmail] = useState('');
  const fieldId = useId();
  const alertId = useId();
  const error = status.kind === 'idle' ? status.error : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === 'pending') return;

    setStatus({ kind: 'pending' });
    const outcome = await (port ?? createLaunchPort()).request({ email, productId });
    setStatus(outcome.ok ? { kind: 'done' } : { kind: 'idle', error: outcome.error });
  }

  if (status.kind === 'done') {
    return (
      <p role='status' className='font-display text-2xl text-foreground md:text-[26px]'>
        {DONE_COPY}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className='flex w-full flex-col gap-2.5'>
      <div className='flex flex-col gap-2.5 md:flex-row md:gap-0'>
        <Label htmlFor={fieldId} className='sr-only'>
          Email
        </Label>
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
          // `md:flex-1` and not `flex-1`: stacked, the field's main axis is
          // vertical and a flex-basis of 0 collapses it to its content height.
          // Matches the checkout field (buyer dialog) at the artboard's 54px.
          // The brand's alarm colour is its primary, not the registry's
          // destructive red.
          className='h-[54px] border-input md:flex-1 bg-foreground/5 px-4 font-sans text-base text-foreground aria-invalid:border-primary aria-invalid:ring-primary/20'
        />
        <Button
          type='submit'
          disabled={status.kind === 'pending'}
          // Label stays "Avisame" while pending: the disabled state is the
          // feedback, and a swapped label would shift the 150px cell.
          className='h-[54px] w-full shrink-0 font-display text-2xl md:w-[150px] md:text-[26px]'
        >
          Avisame
        </Button>
      </div>
      {error && (
        <p id={alertId} role='alert' className='flex items-center gap-2 font-sans text-xs text-primary'>
          <TriangleAlertIcon aria-hidden className='size-3.5 shrink-0' />
          {ERROR_COPY[error]}
        </p>
      )}
      <p className='font-sans text-[11px] text-muted-foreground md:text-xs'>
        Te escribimos una sola vez, el día que salga.
      </p>
    </form>
  );
}
