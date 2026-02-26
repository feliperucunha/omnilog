import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
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
      "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-[var(--color-mid)] bg-[var(--color-darkest)] px-3 py-2 text-sm text-[var(--color-lightest)] transition-colors",
      "placeholder:text-[var(--color-light)]",
      "focus:outline-none focus:ring-2 focus:ring-[var(--color-mid)] focus:ring-offset-2 focus:ring-offset-[var(--color-dark)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=open]:ring-2 data-[state=open]:ring-[var(--color-mid)] data-[state=open]:ring-offset-2 data-[state=open]:ring-offset-[var(--color-dark)]",
      "[&>span]:line-clamp-1 [&>span]:text-left",
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

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-64 min-w-[8rem] overflow-hidden rounded-md border border-[var(--color-mid)]/50 bg-[var(--color-dark)] text-[var(--color-lightest)] shadow-[var(--shadow-lg)]",
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
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
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
      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-3 pr-8 text-sm outline-none",
      "focus:bg-[var(--color-mid)]/40 focus:text-[var(--color-lightest)]",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-lightest)]" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
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
}: SelectProps) {
  return (
    <SelectRoot
      value={value === "" || value == null ? "__empty" : value}
      onValueChange={(v) => onValueChange(v === "__empty" ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn("max-w-xs", triggerClassName)} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value === "" ? "__empty" : opt.value} value={opt.value === "" ? "__empty" : opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}

export { SelectRoot, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };
