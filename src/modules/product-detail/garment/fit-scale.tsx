import FleshLogo from "@/components/shared/flesh-logo";
import { cn } from "@/lib/utils";
import type { GarmentFit } from "@/modules/catalog/client";

type FitScaleProps = { fit: GarmentFit };

const stopsByType = {
  top: ["Slim", "True to size", "Oversized"],
  bottom: ["Slim", "True to size", "Baggy"],
} as const;

export function FitScale({ fit }: FitScaleProps) {
  const percent = Math.round(Math.min(100, Math.max(0, fit.position)));
  const stops = stopsByType[fit.type];

  return (
    <div role="group" aria-label="Fit" className="flex w-full flex-col gap-3.5">
      <p className="font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">Fit</p>
      <div aria-hidden="true" className="relative flex h-2.5 items-center">
        <span className="block h-px w-full bg-border" />
        <span data-fit-marker className="absolute top-1/2 block -translate-x-1/2 -translate-y-1/2" style={{ left: `${percent}%` }}>
          <FleshLogo className="size-6" />
        </span>
      </div>
      <div className="flex font-sans text-[9px] tracking-control text-muted-foreground md:text-[10px]">
        {stops.map((label, index) => (
          <span key={label} className={cn("flex-1", index === 1 && "text-center", index === 2 && "text-right")}>{label}</span>
        ))}
      </div>
      <span className="sr-only">{`Fit ${percent} de 100 en la escala de Slim a ${stops[2]}.`}</span>
    </div>
  );
}
