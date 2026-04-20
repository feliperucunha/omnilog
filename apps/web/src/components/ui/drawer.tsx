import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useAndroidOverlayBack } from "@/hooks/useAndroidOverlayBack";
import { mergeRefs, useRadixDataStateOpenRef } from "@/hooks/useRadixDataStateOpen";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMediaQuery";

/** Match `index.css` `.drawer-panel[data-closing]` transition + `.drawer-scrim` out animation. */
const DRAWER_CLOSE_DURATION_MS = 350;

/** Min distance (px) or fraction of viewport height to dismiss when releasing a downward drag. */
const DISMISS_MIN_PX = 88;
const DISMISS_FRACTION_OF_VH = 0.14;
/** Quick downward flick: avg velocity (px/ms) from drag start to release. */
const DISMISS_VELOCITY_PX_PER_MS = 0.55;
const DISMISS_VELOCITY_MIN_OFFSET_PX = 40;

const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "drawer-scrim fixed inset-0 z-50 bg-black/70",
      "md:data-[state=open]:animate-in md:data-[state=closed]:animate-out md:data-[state=closed]:fade-out-0 md:data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DrawerOverlay";

/** Use inside DrawerContent to pin action buttons at the bottom; the rest of the content scrolls. */
const DrawerFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--color-surface-border)] bg-[var(--color-dark)] pt-4 pb-6",
        className
      )}
      {...props}
    />
  )
);
DrawerFooter.displayName = "DrawerFooter";

type DrawerContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  onClose?: () => void;
  /** On mobile: height of the drawer. Desktop keeps centered modal. */
  mobileHeight?: "95%" | "30%" | "auto";
  /** Called with (animatedClose, closeImmediately). Use closeImmediately for X/close button so overlay and drawer close together. */
  onReady?: (requestClose: () => void, requestCloseImmediately?: () => void) => void;
  /**
   * Runs before dismiss (overlay, drag, escape, Android back). Return false to keep the drawer open
   * (e.g. save failed). Async is awaited.
   */
  onBeforeDismiss?: () => boolean | Promise<boolean>;
  /**
   * When false, overlay / outside-pointer will not close the drawer. Use while a nested dialog
   * (e.g. delete confirm) is open — otherwise Radix treats those interactions as "outside" the drawer.
   */
  closeOnInteractOutside?: boolean;
};

function isDrawerFooter(child: React.ReactNode): boolean {
  return React.isValidElement(child) && child.type === DrawerFooter;
}

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ className, children, onClose, onReady, onBeforeDismiss, mobileHeight = "95%", closeOnInteractOutside = true, ...props }, ref) => {
  const [dataStateRef, radixOpen] = useRadixDataStateOpenRef<HTMLDivElement>();
  /** Mobile drag: transform the sheet surface (Content) so box-shadow moves with the panel, not a stuck “shadow frame”. */
  const dragSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const mergedRef = React.useMemo(
    () => mergeRefs(ref, dataStateRef, dragSurfaceRef),
    [ref, dataStateRef]
  );
  const [isClosing, setIsClosing] = React.useState(false);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobileDrawer = useIsMobile();
  const overlayRef = React.useRef<HTMLDivElement | null>(null);
  const swipeDraggingRef = React.useRef(false);
  const swipeStartYRef = React.useRef(0);
  const swipeStartTimeRef = React.useRef(0);
  const closeInFlightRef = React.useRef(false);

  const resetDragSurfaceStyles = React.useCallback(() => {
    const el = dragSurfaceRef.current;
    if (!el) return;
    el.style.transform = "";
    el.style.transition = "";
    el.style.willChange = "";
  }, []);

  const dismissThresholdPx = React.useCallback(
    () =>
      typeof window !== "undefined"
        ? Math.max(DISMISS_MIN_PX, window.innerHeight * DISMISS_FRACTION_OF_VH)
        : DISMISS_MIN_PX,
    []
  );

  /** Mobile: keep scrim in sync with drag so the gap above the sheet isn’t a solid black layer. */
  const setScrimOpacityForDragY = React.useCallback(
    (y: number) => {
      const el = overlayRef.current;
      if (!el || !isMobileDrawer) return;
      const t = Math.max(1, dismissThresholdPx());
      const p = Math.min(1, Math.max(0, y) / t);
      el.style.animation = "none";
      el.style.opacity = String(1 - p);
    },
    [dismissThresholdPx, isMobileDrawer]
  );

  /** After canceling a drag, fade scrim back to full strength without leaving inline opacity stuck. */
  const restoreScrimAfterDragCancel = React.useCallback(() => {
    const el = overlayRef.current;
    if (!el || !isMobileDrawer) return;
    el.style.animation = "none";
    el.style.transition = "opacity 0.22s cubic-bezier(0.2, 0, 0, 1)";
    el.style.opacity = "1";
    window.setTimeout(() => {
      if (!el.isConnected) return;
      el.style.transition = "";
      el.style.animation = "";
      el.style.opacity = "";
    }, 240);
  }, [isMobileDrawer]);

  React.useEffect(() => {
    if (!isMobileDrawer || !isClosing) return;
    const el = overlayRef.current;
    if (!el) return;
    el.style.animation = "none";
    el.style.transition = `opacity ${DRAWER_CLOSE_DURATION_MS}ms cubic-bezier(0.2, 0, 0, 1)`;
    el.style.opacity = "0";
  }, [isClosing, isMobileDrawer]);

  const runBeforeDismiss = React.useCallback(async (): Promise<boolean> => {
    if (!onBeforeDismiss) return true;
    try {
      return await Promise.resolve(onBeforeDismiss());
    } catch {
      return false;
    }
  }, [onBeforeDismiss]);

  /** Animated close: run slide-down then notify parent. Used for Close button and Escape. */
  const handleClose = React.useCallback(() => {
    if (isClosing || closeInFlightRef.current) return;
    void (async () => {
      closeInFlightRef.current = true;
      try {
        const ok = await runBeforeDismiss();
        if (!ok) {
          restoreScrimAfterDragCancel();
          return;
        }
        setIsClosing(true);
        closeTimeoutRef.current = setTimeout(() => {
          onClose?.();
          closeTimeoutRef.current = null;
        }, DRAWER_CLOSE_DURATION_MS);
      } finally {
        closeInFlightRef.current = false;
      }
    })();
  }, [isClosing, onClose, restoreScrimAfterDragCancel, runBeforeDismiss]);

  /** Close immediately so overlay and content unmount together. Used for overlay/outside click to avoid stuck layer on mobile. */
  const closeImmediately = React.useCallback(() => {
    if (closeInFlightRef.current) return;
    void (async () => {
      closeInFlightRef.current = true;
      try {
        const ok = await runBeforeDismiss();
        if (!ok) {
          restoreScrimAfterDragCancel();
          return;
        }
        if (closeTimeoutRef.current) {
          clearTimeout(closeTimeoutRef.current);
          closeTimeoutRef.current = null;
        }
        onClose?.();
      } finally {
        closeInFlightRef.current = false;
      }
    })();
  }, [onClose, restoreScrimAfterDragCancel, runBeforeDismiss]);

  React.useEffect(() => {
    onReady?.(handleClose, closeImmediately);
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [handleClose, closeImmediately, onReady]);

  /** Android hardware/gesture back: close like scrim tap so Radix unmounts overlay + content together (no delayed onClose leaving the dim layer). */
  const closeImmediatelyRef = React.useRef(closeImmediately);
  closeImmediatelyRef.current = closeImmediately;
  useAndroidOverlayBack(radixOpen, () => {
    closeImmediatelyRef.current();
  });

  React.useEffect(() => {
    if (isClosing) resetDragSurfaceStyles();
  }, [isClosing, resetDragSurfaceStyles]);

  const onSwipeHandlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isMobileDrawer || isClosing) return;
      if (e.button !== 0) return;
      e.preventDefault();
      const surface = dragSurfaceRef.current;
      if (surface) {
        /* Open animation uses fill-mode both; without this, transform stays on the animation layer and drag translate is invisible. */
        surface.style.animation = "none";
        surface.style.willChange = "transform";
      }
      swipeDraggingRef.current = true;
      swipeStartYRef.current = e.clientY;
      swipeStartTimeRef.current = performance.now();
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [isMobileDrawer, isClosing]
  );

  const onSwipeHandlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const surface = dragSurfaceRef.current;
      if (!swipeDraggingRef.current || !surface) return;
      const dy = e.clientY - swipeStartYRef.current;
      const y = Math.max(0, dy);
      surface.style.transition = "none";
      surface.style.transform = `translate3d(0, ${y}px, 0)`;
      setScrimOpacityForDragY(y);
    },
    [setScrimOpacityForDragY]
  );

  const finishSwipeDrag = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!swipeDraggingRef.current) return;
      swipeDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      const surface = dragSurfaceRef.current;
      if (!surface) return;
      const y = Math.max(0, e.clientY - swipeStartYRef.current);
      const elapsed = Math.max(1, performance.now() - swipeStartTimeRef.current);
      const velocity = y / elapsed;
      const threshold = dismissThresholdPx();
      const flickDismiss =
        y >= DISMISS_VELOCITY_MIN_OFFSET_PX && velocity >= DISMISS_VELOCITY_PX_PER_MS;
      if (y >= threshold || flickDismiss) {
        // Avoid resetDragSurfaceStyles here: it clears inline translate before `isClosing`,
        // so the sheet snaps to open for a frame (worse on real devices after async work).
        handleClose();
        return;
      }
      restoreScrimAfterDragCancel();
      surface.style.transition = "transform 0.32s cubic-bezier(0.2, 0, 0, 1)";
      surface.style.transform = "translate3d(0, 0, 0)";
      window.setTimeout(() => {
        if (surface.isConnected) {
          surface.style.transition = "";
          surface.style.transform = "";
          surface.style.willChange = "";
          /* Keep animation: none so reopening slide-in does not re-fire from stylesheet on this open cycle. */
        }
      }, 340);
    },
    [dismissThresholdPx, handleClose, restoreScrimAfterDragCancel]
  );

  const heightClass =
    mobileHeight === "30%"
      ? "max-md:!h-[30%] max-md:!min-h-[30%]"
      : mobileHeight === "auto"
        ? "max-md:!h-auto max-md:!min-h-0 max-md:!max-h-[95dvh]"
        : "max-md:!h-[95dvh] max-md:!min-h-[95dvh]";
  /** `h-auto` + inner `flex-1 h-full` collapses body height; use intrinsic column layout on mobile. */
  const isAutoMobileHeight = mobileHeight === "auto";
  return (
    <DialogPortal>
      <DialogOverlay
        ref={overlayRef}
        onClick={closeOnInteractOutside ? closeImmediately : undefined}
        onPointerDown={closeOnInteractOutside ? closeImmediately : undefined}
      />
      <DialogPrimitive.Content
        ref={mergedRef}
        data-closing={isClosing ? "true" : undefined}
        className={cn(
          "drawer-panel z-50 flex min-h-0 flex-col overflow-hidden bg-[var(--color-dark)]",
          "max-md:shadow-[0_-8px_36px_rgba(0,0,0,0.48),0_-2px_12px_rgba(0,0,0,0.35)] md:shadow-[var(--shadow-modal)]",
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:rounded-t-2xl max-md:border-t max-md:border-[var(--color-surface-border)] max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)]",
          heightClass,
          "md:!translate-y-0 md:fixed md:inset-0 md:left-1/2 md:top-1/2 md:h-auto md:max-h-[90vh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg md:border md:border-[var(--color-surface-border)] md:pb-0 md:transition-[transform,opacity] md:duration-200",
          "md:data-[state=open]:animate-in md:data-[state=closed]:animate-out md:data-[state=closed]:fade-out-0 md:data-[state=open]:fade-in-0",
          "md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95 md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=closed]:slide-out-to-top-[48%] md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=open]:slide-in-from-top-[48%]",
          className
        )}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          handleClose();
        }}
        onPointerDownOutside={(e) => {
          if (!closeOnInteractOutside) {
            e.preventDefault();
            return;
          }
          const target = e.target as HTMLElement;
          if (target.closest("[data-radix-select-content]") || target.closest("[data-dropdown-portal]")) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          closeImmediately();
        }}
        onInteractOutside={(e) => {
          if (!closeOnInteractOutside) {
            e.preventDefault();
            return;
          }
          const target = e.target as HTMLElement;
          if (target.closest("[data-radix-select-content]") || target.closest("[data-dropdown-portal]")) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          closeImmediately();
        }}
        {...props}
      >
        {(() => {
          const childArray = React.Children.toArray(children);
          const footerIndex = childArray.findIndex((c) => isDrawerFooter(c));
          const hasFooter = footerIndex >= 0;
          const footer = hasFooter ? childArray[footerIndex] : null;
          const contentChildren = hasFooter ? childArray.filter((_, i) => i !== footerIndex) : childArray;
          return (
            <div
              className={cn(
                "flex w-full flex-col min-h-0",
                isAutoMobileHeight
                  ? "max-md:h-auto max-md:min-h-0"
                  : "max-md:flex-1 max-md:h-full",
                "md:contents"
              )}
            >
              {/* Mobile: drag handle — swipe down to dismiss (matches common sheet UX). */}
              <div
                className={cn(
                  "flex shrink-0 touch-none select-none flex-col items-center justify-center gap-1.5 py-3 cursor-grab active:cursor-grabbing",
                  "md:hidden"
                )}
                onPointerDown={onSwipeHandlePointerDown}
                onPointerMove={onSwipeHandlePointerMove}
                onPointerUp={finishSwipeDrag}
                onPointerCancel={finishSwipeDrag}
                aria-label="Drag down to close"
              >
                <span className="block h-1 w-10 shrink-0 rounded-full bg-[var(--color-mid)]/80" />
              </div>
              {/* Scrollable body: fixed-height sheets use flex-1; auto-height sheets size to content (cap scroll). */}
              <div
                className={cn(
                  "min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain",
                  isAutoMobileHeight
                    ? "max-md:max-h-[min(72dvh,620px)] max-md:flex-shrink-0"
                    : "flex-1 basis-0"
                )}
              >
                {contentChildren}
              </div>
              {/* Fixed footer: always at bottom, same position, never scrolls */}
              {footer}
            </div>
          );
        })()}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

export const Drawer = Dialog;
export { DrawerContent, DrawerFooter };
