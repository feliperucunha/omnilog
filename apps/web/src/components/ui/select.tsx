import * as React from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useLocale } from "@/contexts/LocaleContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const SelectRoot = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "group flex w-full items-center justify-between gap-2 rounded-md border border-[var(--color-mid)] bg-[var(--color-darkest)] px-3 py-2 text-sm text-[var(--color-lightest)] transition-colors [touch-action:manipulation]",
      "max-md:h-full max-md:min-h-[44px]",
      "md:h-9 md:min-h-9 md:max-h-9 md:py-1",
      "placeholder:text-[var(--color-light)]",
      "focus:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "[&>:first-child]:min-w-0 [&>:first-child]:flex-1 [&>:first-child]:overflow-hidden [&>:first-child]:text-left",
      "[&_svg]:pointer-events-none",
      "max-md:min-h-[48px] max-md:rounded-xl max-md:border-[var(--color-surface-border)] max-md:bg-[var(--color-dark)] max-md:px-4 max-md:text-base max-md:shadow-[var(--shadow-sm)]",
      "max-md:data-[state=open]:border-[var(--color-mid)]",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform group-data-[state=open]:rotate-180 max-md:h-7 max-md:w-7 max-md:rounded-full max-md:bg-[var(--color-mid)]/15 max-md:p-1.5" aria-hidden />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

type SelectContentProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
  /** Scroll long lists inside the panel (e.g. currency). Does not affect other selects unless set. */
  viewportClassName?: string;
  /** Bottom fade overlay so long scrollable lists read as “more below”. */
  scrollHint?: boolean;
  viewportRef?: React.Ref<HTMLDivElement>;
  onViewportScroll?: React.UIEventHandler<HTMLDivElement>;
  mobileHeader?: ReactNode;
  mobileWheel?: boolean;
  sheetOpen?: boolean;
};

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = "popper", viewportClassName, scrollHint, viewportRef, onViewportScroll, mobileHeader, mobileWheel = false, sheetOpen = false, ...props }, ref) => (
  <>
    {sheetOpen && typeof document !== "undefined"
      ? createPortal(<div className="fixed inset-0 z-[99] bg-black/60 md:hidden" aria-hidden />, document.body)
      : null}
    <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      data-dropdown-portal
      data-select-sheet={mobileWheel ? "" : undefined}
      className={cn(
        "relative z-[100] min-w-[8rem] max-w-[min(calc(100dvw-1rem),36rem)] overflow-x-hidden rounded-md border border-[var(--color-mid)]/50 bg-[var(--color-dark)] text-[var(--color-lightest)] shadow-[var(--shadow-lg)]",
        "[touch-action:manipulation]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        "max-md:!fixed max-md:!inset-x-0 max-md:!bottom-0 max-md:!top-auto max-md:!w-full max-md:!max-w-none max-md:!translate-x-0 max-md:!translate-y-0",
        "max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0 max-md:border-t max-md:border-[var(--color-surface-border)] max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:shadow-[0_-8px_36px_rgba(0,0,0,0.48),0_-2px_12px_rgba(0,0,0,0.35)]",
        className
      )}
      position={position}
      {...props}
    >
      {mobileHeader}
      <div className="relative">
        {mobileWheel ? (
          <div className="pointer-events-none absolute inset-x-4 top-1/2 z-[1] h-11 -translate-y-1/2 rounded-xl border-y border-[var(--color-mid)]/30 bg-[var(--color-mid)]/10" aria-hidden />
        ) : null}
        <SelectPrimitive.Viewport
          ref={viewportRef}
          onScroll={onViewportScroll}
          className={cn(
            "p-1",
            position === "popper" &&
              "min-w-[var(--radix-select-trigger-width)] w-max max-w-[min(calc(100dvw-1rem),36rem)]",
            mobileWheel &&
              "max-md:relative max-md:!w-full max-md:!min-w-0 max-md:!max-w-none max-md:!max-h-[220px] max-md:snap-y max-md:snap-mandatory max-md:overflow-y-auto max-md:overscroll-y-contain max-md:py-[88px] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden",
            viewportClassName
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </div>
      {scrollHint ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-7 rounded-b-md bg-gradient-to-t from-[var(--color-dark)] via-[var(--color-dark)]/70 to-transparent" aria-hidden />
      ) : null}
    </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

type SelectItemProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
  wheelDistance?: number;
};

const SelectItem = React.forwardRef<React.ComponentRef<typeof SelectPrimitive.Item>, SelectItemProps>(
  ({ className, children, style, wheelDistance, ...props }, ref) => {
    const wheelStyle =
      wheelDistance == null
        ? undefined
        : {
            transform: `perspective(700px) rotateX(${Math.max(-60, Math.min(60, wheelDistance * -18))}deg) scale(${1 - Math.min(Math.abs(wheelDistance), 4) * 0.07})`,
            opacity: Math.max(0.25, 1 - Math.abs(wheelDistance) * 0.22),
          };
    return (
      <SelectPrimitive.Item
        ref={ref}
        style={wheelStyle ? { ...style, ...wheelStyle } : style}
        className={cn(
          "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2.5 pl-3 pr-8 text-sm outline-none min-h-[44px] [touch-action:manipulation]",
          "focus:bg-[var(--color-mid)]/40 focus:text-[var(--color-lightest)] active:bg-[var(--color-mid)]/40",
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          "max-md:h-11 max-md:rounded-lg max-md:px-4 max-md:text-base max-md:snap-center",
          wheelDistance === 0 && "max-md:bg-[var(--color-mid)]/10 max-md:font-semibold max-md:text-[var(--color-lightest)]",
          className
        )}
        {...props}
      >
        <SelectPrimitive.ItemText asChild>
          <span className="block min-w-0 flex-1 self-center pr-1">
            <OverflowMarquee>{children}</OverflowMarquee>
          </span>
        </SelectPrimitive.ItemText>
        <span className="pointer-events-none absolute right-2 flex h-4 w-4 shrink-0 items-center justify-center max-md:right-4">
          <SelectPrimitive.ItemIndicator>
            <Check className="h-4 w-4 shrink-0 text-[var(--btn-gradient-start)]" aria-hidden />
          </SelectPrimitive.ItemIndicator>
        </span>
      </SelectPrimitive.Item>
    );
  }
);
SelectItem.displayName = SelectPrimitive.Item.displayName;

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** Used for trigger aria-label / title when `label` is not plain text. */
  accessibleLabel?: string;
  disabled?: boolean;
  className?: string;
}

function optionAccessibleLabel(opt: SelectOption | undefined): string | undefined {
  if (!opt) return undefined;
  if (opt.accessibleLabel) return opt.accessibleLabel;
  if (typeof opt.label === "string") return opt.label;
  return undefined;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  "aria-label"?: string;
  /** When set, shown in the closed trigger instead of the selected option label (e.g. ISO code only). */
  triggerLabel?: string;
  /** Optional native tooltip on the trigger (e.g. full currency name). */
  triggerTitle?: string;
  /** Overrides `aria-label` on the trigger (use with `triggerLabel` so screen readers get the full option). */
  triggerAriaLabel?: string;
  /** Limit dropdown height and scroll inside (e.g. long currency lists); mobile and desktop. */
  contentScrollable?: boolean;
}

/** Styled select dropdown; use for form fields. Replaces native &lt;select&gt;. */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "—",
  disabled,
  className,
  triggerClassName,
  "aria-label": ariaLabel,
  triggerLabel,
  triggerTitle,
  triggerAriaLabel,
  contentScrollable,
}: SelectProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const normalize = (v: string | null | undefined) => (v === "" || v == null ? "__empty" : v);
  const rootValue = normalize(value);
  const [open, setOpen] = React.useState(false);
  const [draftValue, setDraftValue] = React.useState(rootValue);
  const draftRef = React.useRef(rootValue);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const didCenterRef = React.useRef(false);
  const skipScrollSelectRef = React.useRef(false);

  const selectedOption = options.find((opt) => normalize(opt.value) === rootValue);
  const valueSummary = optionAccessibleLabel(selectedOption) ?? placeholder;
  const triggerDisplay = selectedOption?.label ?? placeholder;
  const triggerAccessibleName = triggerAriaLabel ?? (ariaLabel ? `${ariaLabel}, ${valueSummary}` : valueSummary);
  const activeValue = isMobile && open ? draftValue : rootValue;
  const activeIndexRaw = options.findIndex((opt) => normalize(opt.value) === activeValue);
  const activeIndex = activeIndexRaw < 0 ? 0 : activeIndexRaw;
  const sheetTitle = (triggerAriaLabel ?? ariaLabel ?? triggerAccessibleName).split(",")[0];

  const scrollViewportClass =
    contentScrollable === true && !isMobile
      ? "max-h-[min(50dvh,20rem)] overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
      : undefined;

  const setDraft = React.useCallback((next: string) => {
    draftRef.current = next;
    setDraftValue(next);
  }, []);

  const resetDraft = React.useCallback(() => {
    setDraft(rootValue);
  }, [rootValue, setDraft]);

  const commitDraft = React.useCallback(() => {
    const current = draftRef.current;
    if (current !== rootValue) onValueChange(current === "__empty" ? "" : current);
    draftRef.current = rootValue;
  }, [onValueChange, rootValue]);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isMobile) {
        setOpen(next);
        return;
      }
      if (next) {
        resetDraft();
        setOpen(true);
        return;
      }
      commitDraft();
      setOpen(false);
    },
    [commitDraft, isMobile, resetDraft]
  );

  React.useLayoutEffect(() => {
    if (!open) {
      didCenterRef.current = false;
      return;
    }
    if (!isMobile || didCenterRef.current) return;
    const viewport = viewportRef.current;
    const item = viewport?.querySelectorAll<HTMLElement>("[role=option]")[activeIndex];
    if (!viewport || !item) return;
    skipScrollSelectRef.current = true;
    viewport.scrollTop = item.offsetTop - viewport.clientHeight / 2 + item.offsetHeight / 2;
    window.requestAnimationFrame(() => {
      skipScrollSelectRef.current = false;
    });
    didCenterRef.current = true;
  }, [open, isMobile, activeIndex]);

  const handleViewportScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!isMobile || skipScrollSelectRef.current) return;
      const viewport = event.currentTarget;
      const items = Array.from(viewport.querySelectorAll<HTMLElement>("[role=option]"));
      if (items.length === 0) return;
      const center = viewport.scrollTop + viewport.clientHeight / 2;
      let closestIndex = -1;
      let closestDistance = Number.POSITIVE_INFINITY;
      items.forEach((item, index) => {
        if (item.hasAttribute("data-disabled")) return;
        const option = options[index];
        if (!option) return;
        const itemCenter = item.offsetTop + item.offsetHeight / 2;
        const distance = Math.abs(itemCenter - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      const option = options[closestIndex];
      if (option) setDraft(normalize(option.value));
    },
    [isMobile, options, setDraft]
  );

  const mobileHeader = isMobile ? (
    <div className="md:hidden">
      <div className="flex justify-center py-3">
        <span className="block h-1 w-10 rounded-full bg-[var(--color-mid)]/80" />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 pb-3">
        <button
          type="button"
          onClick={() => {
            resetDraft();
            setOpen(false);
          }}
          className="min-h-9 rounded-md px-2 text-sm text-[var(--color-light)] [touch-action:manipulation] active:opacity-70"
        >
          {t("common.cancel")}
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-[var(--color-light)]">
          {sheetTitle}
        </span>
        <button
          type="button"
          onClick={() => {
            commitDraft();
            setOpen(false);
          }}
          className="min-h-9 rounded-md px-2 text-sm font-semibold text-[var(--btn-gradient-start)] [touch-action:manipulation] active:opacity-70"
        >
          {t("common.done")}
        </button>
      </div>
    </div>
  ) : undefined;

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col",
        "max-md:h-full max-md:self-stretch",
        "md:h-auto md:self-auto",
        className
      )}
    >
      <SelectRoot
        value={activeValue}
        onValueChange={(v) => {
          if (isMobile) setDraft(v);
          else onValueChange(v === "__empty" ? "" : v);
        }}
        open={open}
        onOpenChange={handleOpenChange}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn("min-h-0 min-w-0 w-full max-w-full max-md:flex-1", triggerClassName)}
          aria-label={triggerAccessibleName}
          title={
            triggerTitle ??
            (triggerLabel != null
              ? undefined
              : optionAccessibleLabel(selectedOption) ??
                (typeof triggerDisplay === "string" ? triggerDisplay : undefined))
          }
        >
          {triggerLabel != null ? (
            <OverflowMarquee className="text-left">{triggerLabel}</OverflowMarquee>
          ) : (
            <OverflowMarquee className="text-left">{triggerDisplay}</OverflowMarquee>
          )}
        </SelectTrigger>
        <SelectContent
          viewportRef={viewportRef}
          onViewportScroll={handleViewportScroll}
          mobileHeader={mobileHeader}
          mobileWheel={isMobile}
          sheetOpen={open}
          viewportClassName={scrollViewportClass}
          scrollHint={contentScrollable === true && !isMobile}
        >
          {options.map((opt, index) => (
            <SelectItem
              key={opt.value === "" ? "__empty" : opt.value}
              value={opt.value === "" ? "__empty" : opt.value}
              disabled={opt.disabled === true}
              className={opt.className}
              wheelDistance={isMobile ? index - activeIndex : undefined}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </div>
  );
}

export { SelectRoot, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };
