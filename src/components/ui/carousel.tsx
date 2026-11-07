"use client"

import * as React from "react"
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type CarouselApi = UseEmblaCarouselType[1]
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>
type CarouselOptions = UseCarouselParameters[0]
type CarouselPlugin = UseCarouselParameters[1]

type CarouselProps = {
  opts?: CarouselOptions
  plugins?: CarouselPlugin
  orientation?: "horizontal" | "vertical"
  setApi?: (api: CarouselApi) => void
}

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: ReturnType<typeof useEmblaCarousel>[1]
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
} & CarouselProps

const CarouselContext = React.createContext<CarouselContextProps | null>(null)

function useCarousel() {
  const context = React.useContext(CarouselContext)

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />")
  }

  return context
}

function Carousel({
  orientation = "horizontal",
  opts,
  setApi,
  plugins,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel(
    {
      ...opts,
      axis: orientation === "horizontal" ? "x" : "y",
    },
    plugins
  )
  const [canScrollPrev, setCanScrollPrev] = React.useState(false)
  const [canScrollNext, setCanScrollNext] = React.useState(false)

  const onSelect = React.useCallback((api: CarouselApi) => {
    if (!api) return
    setCanScrollPrev(api.canScrollPrev())
    setCanScrollNext(api.canScrollNext())
  }, [])

  const scrollPrev = React.useCallback(() => {
    api?.scrollPrev()
  }, [api])

  const scrollNext = React.useCallback(() => {
    api?.scrollNext()
  }, [api])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        scrollPrev()
      } else if (event.key === "ArrowRight") {
        event.preventDefault()
        scrollNext()
      }
    },
    [scrollPrev, scrollNext]
  )

  React.useEffect(() => {
    if (!api || !setApi) return
    setApi(api)
  }, [api, setApi])

  React.useEffect(() => {
    if (!api) return
    onSelect(api)
    api.on("reInit", onSelect)
    api.on("select", onSelect)

    return () => {
      api?.off("select", onSelect)
    }
  }, [api, onSelect])

  return (
    <CarouselContext.Provider
      value={{
        carouselRef,
        api: api,
        opts,
        orientation:
          orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev,
        scrollNext,
        canScrollPrev,
        canScrollNext,
      }}
    >
      <div
        onKeyDownCapture={handleKeyDown}
        className={cn("relative", className)}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

function CarouselContent({
  className,
  viewportClassName,
  ...props
}: React.ComponentProps<"div"> & { viewportClassName?: string }) {
  const { carouselRef, orientation } = useCarousel()

  return (
    <div
      ref={carouselRef}
      // This div is Embla's OWN scroll container — `carouselRef` is the exact
      // node `useEmblaCarousel` hands to the engine as its root. It is the
      // only element a caller can turn into a native scrollable viewport (for
      // a breakpoint where Embla itself stays inactive), and the primitive
      // otherwise never exposes it to a caller at all.
      className={cn("overflow-hidden", viewportClassName)}
      data-slot="carousel-content"
    >
      <div
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className
        )}
        {...props}
      />
    </div>
  )
}

function CarouselItem({ className, ...props }: React.ComponentProps<"div">) {
  const { orientation } = useCarousel()

  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className
      )}
      {...props}
    />
  )
}

/**
 * Both arrows are invisible hit areas over one half of the slide each, with a
 * big display-font glyph pushed to the outer edge. The brand wanted the whole
 * half of the photo to be the control (a thumb never has to find a 28px
 * target), and the glyph only to say which way it goes.
 *
 * Still the design system `Button`, so the focus-visible ring and the
 * disabled handling come with it; the overrides only strip its chrome.
 * Resting colour is `muted-foreground` (oklch .85), the closest token to the
 * light grey the brand picked (oklch .87); hover and press go to `primary`.
 * The hard black shadow keeps the glyph legible over any photo.
 */
// `active:…:translate-y-0` cancels Button's 1px press translate: on an
// absolutely positioned arrow that translate replaces any centring transform,
// so the arrow jumped on every click. The colour change is the press feedback.
const ARROW_CLASS =
  "absolute z-5 cursor-pointer rounded-none border-0 bg-transparent px-4 font-display text-4xl tracking-[-2px] text-muted-foreground text-shadow-[4px_4px_0_black] hover:bg-transparent hover:text-primary active:text-primary active:not-aria-[haspopup]:translate-y-0 dark:hover:bg-transparent"

function CarouselPrevious({
  className,
  variant = "ghost",
  size = "default",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      data-slot="carousel-previous"
      variant={variant}
      size={size}
      aria-label="Imagen anterior"
      className={cn(
        ARROW_CLASS,
        orientation === "horizontal"
          ? "top-0 left-0 h-full w-1/2 justify-start text-left"
          : "top-0 left-0 h-1/2 w-full items-start",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <span aria-hidden="true" className={orientation === "vertical" ? "rotate-90" : undefined}>
        {"<<"}
      </span>
    </Button>
  )
}

function CarouselNext({
  className,
  variant = "ghost",
  size = "default",
  ...props
}: React.ComponentProps<typeof Button>) {
  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      data-slot="carousel-next"
      variant={variant}
      size={size}
      aria-label="Imagen siguiente"
      className={cn(
        ARROW_CLASS,
        orientation === "horizontal"
          ? "top-0 right-0 h-full w-1/2 justify-end text-right"
          : "bottom-0 left-0 h-1/2 w-full items-end",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <span aria-hidden="true" className={orientation === "vertical" ? "rotate-90" : undefined}>
        {">>"}
      </span>
    </Button>
  )
}

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  useCarousel,
}
