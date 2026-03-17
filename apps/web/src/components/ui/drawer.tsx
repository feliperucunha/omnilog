import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const DRAWER_CLOSE_DURATION_MS = 350;

const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
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
  mobileHeight?: "95%" | "30%";
  /** Called with (animatedClose, closeImmediately). Use closeImmediately for X/close button so overlay and drawer close together. */
  onReady?: (requestClose: () => void, requestCloseImmediately?: () => void) => void;
};

function isDrawerFooter(child: React.ReactNode): boolean {
  return React.isValidElement(child) && child.type === DrawerFooter;
}

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ className, children, onClose, onReady, mobileHeight = "95%", ...props }, ref) => {
  const [isClosing, setIsClosing] = React.useState(false);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Animated close: run slide-down then notify parent. Used for Close button and Escape. */
  const handleClose = React.useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      onClose?.();
      closeTimeoutRef.current = null;
    }, DRAWER_CLOSE_DURATION_MS);
  }, [isClosing, onClose]);

  /** Close immediately so overlay and content unmount together. Used for overlay/outside click to avoid stuck layer on mobile. */
  const closeImmediately = React.useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    onClose?.();
  }, [onClose]);

  React.useEffect(() => {
    onReady?.(handleClose, closeImmediately);
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [handleClose, closeImmediately, onReady]);

  const heightClass =
    mobileHeight === "30%"
      ? "max-md:!h-[30%] max-md:!min-h-[30%]"
      : "max-md:!h-[95dvh] max-md:!min-h-[95dvh]";
  return (
    <DialogPortal>
      <DialogOverlay onClick={closeImmediately} onPointerDown={closeImmediately} />
      <DialogPrimitive.Content
        ref={ref}
        data-closing={isClosing ? "true" : undefined}
        className={cn(
          "drawer-panel z-50 flex min-h-0 flex-col overflow-hidden bg-[var(--color-dark)]",
          "max-md:shadow-[0_-8px_40px_rgba(0,0,0,0.5),0_-2px_16px_rgba(0,0,0,0.4)] md:shadow-[var(--shadow-modal)]",
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
          const target = e.target as HTMLElement;
          if (target.closest("[data-radix-select-content]") || target.closest("[data-dropdown-portal]")) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          closeImmediately();
        }}
        onInteractOutside={(e) => {
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
            <>
              {/* Scrollable body: takes all remaining space; only this area scrolls */}
              <div className="min-h-0 flex-1 basis-0 overflow-x-hidden overflow-y-auto overscroll-contain">
                {contentChildren}
              </div>
              {/* Fixed footer: always at bottom, same position, never scrolls */}
              {footer}
            </>
          );
        })()}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

export const Drawer = Dialog;
export { DrawerContent, DrawerFooter };
