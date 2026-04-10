import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { OverflowMarquee } from "@/components/OverflowMarquee";
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
      "flex h-10 w-full max-md:min-h-[44px] items-center justify-between gap-2 rounded-md border border-[var(--color-mid)] bg-[var(--color-darkest)] px-3 py-2 text-sm text-[var(--color-lightest)] transition-colors",
      "placeholder:text-[var(--color-light)]",
      "focus:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "[&>:first-child]:min-w-0 [&>:first-child]:flex-1 [&>:first-child]:overflow-hidden [&>:first-child]:text-left",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

type SelectContentProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
  /** Scroll long lists inside the panel (e.g. currency). Does not affect other selects unless set. */
  viewportClassName?: string;
  /** Bottom fade overlay so long scrollable lists read as “more below”. */
  scrollHint?: boolean;
};

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = "popper", viewportClassName, scrollHint, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      data-dropdown-portal
      className={cn(
        "relative z-[100] min-w-[8rem] max-w-[min(calc(100dvw-1rem),36rem)] overflow-x-hidden rounded-md border border-[var(--color-mid)]/50 bg-[var(--color-dark)] text-[var(--color-lightest)] shadow-[var(--shadow-lg)]",
        "[touch-action:manipulation]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "min-w-[var(--radix-select-trigger-width)] w-max max-w-[min(calc(100dvw-1rem),36rem)]",
          viewportClassName
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      {scrollHint ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-7 rounded-b-md bg-gradient-to-t from-[var(--color-dark)] via-[var(--color-dark)]/70 to-transparent"
          aria-hidden
        />
      ) : null}
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2.5 pl-3 pr-8 text-sm outline-none min-h-[44px] [touch-action:manipulation]",
      "focus:bg-[var(--color-mid)]/40 focus:text-[var(--color-lightest)] active:bg-[var(--color-mid)]/40",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText asChild>
      <span className="block min-w-0 flex-1 self-center pr-1">
        <OverflowMarquee>{children}</OverflowMarquee>
      </span>
    </SelectPrimitive.ItemText>
    <span className="pointer-events-none absolute right-2 flex h-4 w-4 shrink-0 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-lightest)]" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export interface SelectOption {
  value: string;
  label: string;
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
  const rootValue = value === "" || value == null ? "__empty" : value;
  const selectedOption = options.find((opt) => (opt.value === "" ? "__empty" : opt.value) === rootValue);
  const valueSummary = selectedOption?.label ?? placeholder;
  const triggerAccessibleName = triggerAriaLabel ?? (ariaLabel ? `${ariaLabel}, ${valueSummary}` : valueSummary);

  const scrollViewportClass =
    contentScrollable === true
      ? "max-h-[min(50dvh,20rem)] overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
      : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <SelectRoot
        value={rootValue}
        onValueChange={(v) => onValueChange(v === "__empty" ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn("min-w-0 w-full max-w-full", triggerClassName)}
          aria-label={triggerAccessibleName}
          title={
            triggerTitle ??
            (triggerLabel != null ? undefined : typeof valueSummary === "string" ? valueSummary : undefined)
          }
        >
          {triggerLabel != null ? (
            <OverflowMarquee className="text-left">{triggerLabel}</OverflowMarquee>
          ) : (
            <OverflowMarquee className="text-left">{valueSummary}</OverflowMarquee>
          )}
        </SelectTrigger>
        <SelectContent viewportClassName={scrollViewportClass} scrollHint={contentScrollable === true}>
          {options.map((opt) => (
            <SelectItem key={opt.value === "" ? "__empty" : opt.value} value={opt.value === "" ? "__empty" : opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </div>
  );
}

export { SelectRoot, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };
