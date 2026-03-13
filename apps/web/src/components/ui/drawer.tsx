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

type DrawerContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  onClose?: () => void;
  /** On mobile: height of the drawer. Desktop keeps centered modal. */
  mobileHeight?: "95%" | "30%";
  /** Called with the animated close function so parents can use it for Cancel/close buttons. */
  onReady?: (requestClose: () => void) => void;
};

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ className, children, onClose, onReady, mobileHeight = "95%", ...props }, ref) => {
  const [isClosing, setIsClosing] = React.useState(false);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = React.useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
      onClose?.();
      closeTimeoutRef.current = null;
    }, DRAWER_CLOSE_DURATION_MS);
  }, [isClosing, onClose]);

  React.useEffect(() => {
    onReady?.(handleClose);
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [handleClose, onReady]);

  const heightClass = mobileHeight === "30%" ? "max-md:!h-[30%]" : "max-md:!h-[95%]";
  return (
    <DialogPortal>
      <DialogOverlay onClick={handleClose} />
      <DialogPrimitive.Content
        ref={ref}
        data-closing={isClosing ? "true" : undefined}
        className={cn(
          "drawer-panel z-50 flex flex-col overflow-hidden bg-[var(--color-dark)]",
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
          handleClose();
        }}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

export const Drawer = Dialog;
export { DrawerContent };
