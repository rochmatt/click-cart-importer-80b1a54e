import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, X } from "lucide-react";

interface ProductImageCarouselProps {
  images: string[];
  alt: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

export function ProductImageCarousel({ images, alt }: ProductImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeDx, setSwipeDx] = useState(0);
  const hasMultiple = images.length > 1;

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex((index + images.length) % images.length);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    },
    [images.length],
  );

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const changeZoom = useCallback((delta: number) => {
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((z + delta) * 10) / 10));
      if (next === MIN_ZOOM) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen();
      if (e.key === "ArrowLeft") goTo(activeIndex - 1);
      if (e.key === "ArrowRight") goTo(activeIndex + 1);
      if (e.key === "+" || e.key === "=") changeZoom(ZOOM_STEP);
      if (e.key === "-") changeZoom(-ZOOM_STEP);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isFullscreen, activeIndex, goTo, closeFullscreen, changeZoom]);

  return (
    <div className="flex flex-col gap-3">
      <div className="group relative overflow-hidden rounded-2xl border border-border bg-secondary max-h-[55vh] sm:max-h-none">
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          aria-label="View image fullscreen"
          className="block w-full cursor-zoom-in"
        >
          <img
            src={images[activeIndex]}
            alt={`${alt} — photo ${activeIndex + 1} of ${images.length}`}
            width={800}
            height={800}
            data-testid="carousel-main-image"
            className="aspect-square w-full object-cover max-h-[55vh] sm:max-h-[600px]"
          />
        </button>
        <span className="pointer-events-none absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground shadow-sm">
          <Maximize2 className="h-3.5 w-3.5" />
        </span>
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`View image ${index + 1}`}
              aria-pressed={index === activeIndex}
              className={`relative shrink-0 overflow-hidden rounded-lg border bg-secondary transition-all ${
                index === activeIndex
                  ? "border-primary ring-2 ring-primary ring-offset-1 ring-offset-background"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <img
                src={src}
                alt={`${alt} thumbnail ${index + 1}`}
                width={64}
                height={64}
                className="aspect-square h-11 w-11 object-cover sm:h-12 sm:w-12"
              />
            </button>
          ))}
        </div>
      )}

      {isFullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} fullscreen gallery`}
          data-testid="carousel-lightbox"
          className="fixed inset-0 z-[100] flex flex-col bg-foreground/95 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
            <span className="rounded-full bg-background/10 px-3 py-1 text-xs font-medium text-background">
              {activeIndex + 1} / {images.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeZoom(-ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Zoom out"
                className="grid h-10 w-10 place-items-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-background disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-12 text-center text-xs font-semibold text-background">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => changeZoom(ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Zoom in"
                className="grid h-10 w-10 place-items-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-background disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={closeFullscreen}
                aria-label="Close fullscreen"
                className="grid h-10 w-10 place-items-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-background"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            className="relative flex flex-1 touch-none items-center justify-center overflow-hidden"
            onWheel={(e) => changeZoom(e.deltaY < 0 ? ZOOM_STEP / 2 : -ZOOM_STEP / 2)}
            onPointerDown={(e) => {
              (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
              pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (pointersRef.current.size === 2) {
                const [a, b] = [...pointersRef.current.values()];
                pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
                dragRef.current = null;
                swipeRef.current = null;
                setSwipeDx(0);
              } else if (pointersRef.current.size === 1) {
                if (zoom > MIN_ZOOM) {
                  dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
                } else if (hasMultiple) {
                  swipeRef.current = { x: e.clientX, y: e.clientY };
                }
              }
            }}
            onPointerMove={(e) => {
              if (pointersRef.current.has(e.pointerId)) {
                pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              }
              const pinch = pinchRef.current;
              if (pinch && pointersRef.current.size >= 2) {
                const [a, b] = [...pointersRef.current.values()];
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinch.dist > 0) {
                  const next = Math.min(
                    MAX_ZOOM,
                    Math.max(MIN_ZOOM, (pinch.zoom * dist) / pinch.dist),
                  );
                  setZoom(next);
                  if (next === MIN_ZOOM) setOffset({ x: 0, y: 0 });
                }
                return;
              }
              const s = swipeRef.current;
              if (s) {
                const dx = e.clientX - s.x;
                const dy = e.clientY - s.y;
                if (Math.abs(dx) > Math.abs(dy)) setSwipeDx(dx);
                return;
              }
              const d = dragRef.current;
              if (!d) return;
              setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
            }}
            onPointerUp={(e) => {
              pointersRef.current.delete(e.pointerId);
              if (pointersRef.current.size < 2) pinchRef.current = null;
              dragRef.current = null;
              const s = swipeRef.current;
              swipeRef.current = null;
              if (s && zoom <= MIN_ZOOM) {
                const dx = e.clientX - s.x;
                const dy = e.clientY - s.y;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                  goTo(activeIndex + (dx < 0 ? 1 : -1));
                }
              }
              setSwipeDx(0);
            }}
            onPointerCancel={(e) => {
              pointersRef.current.delete(e.pointerId);
              pinchRef.current = null;
              dragRef.current = null;
              swipeRef.current = null;
              setSwipeDx(0);
            }}
            onPointerLeave={(e) => {
              pointersRef.current.delete(e.pointerId);
              if (pointersRef.current.size < 2) pinchRef.current = null;
              dragRef.current = null;
              swipeRef.current = null;
              setSwipeDx(0);
            }}
          >

            <img
              src={images[activeIndex]}
              alt={`${alt} — photo ${activeIndex + 1} of ${images.length}`}
              data-testid="lightbox-image"
              draggable={false}
              onDoubleClick={() => (zoom > MIN_ZOOM ? (setZoom(1), setOffset({ x: 0, y: 0 })) : setZoom(2))}
              style={{
                transform: `translate(${offset.x + swipeDx}px, ${offset.y}px) scale(${zoom})`,
                opacity: swipeDx ? Math.max(0.5, 1 - Math.abs(swipeDx) / 400) : 1,
                transition: swipeDx ? "none" : "transform 100ms, opacity 150ms",
              }}
              className={`max-h-full max-w-full select-none object-contain ${
                zoom > MIN_ZOOM ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
              }`}
            />

            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(activeIndex - 1)}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-background"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(activeIndex + 1)}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-background/90 text-foreground transition-colors hover:bg-background"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {hasMultiple && (
            <div className="flex justify-center gap-2 overflow-x-auto p-3 sm:p-4">
              {images.map((src, index) => (
                <button
                  key={`fs-${src}-${index}`}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`View image ${index + 1}`}
                  aria-pressed={index === activeIndex}
                  className={`shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    index === activeIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={src}
                    alt={`${alt} thumbnail ${index + 1}`}
                    className="h-11 w-11 object-cover sm:h-12 sm:w-12"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
