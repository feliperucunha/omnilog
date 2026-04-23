import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2 } from "lucide-react";
import type { MediaType } from "@geeklogs/shared";
import { cn } from "@/lib/utils";

export type MediaCategoryDragListProps = {
  order: MediaType[];
  onReorder: (next: MediaType[]) => void;
  selected: Set<MediaType>;
  onToggle: (type: MediaType) => void;
  disabled?: boolean;
  /** When true, shows a non-interactive overlay with spinner (e.g. while saving order to the server). */
  isPending?: boolean;
  /** Shown next to the spinner when `isPending` is true (screen readers + sighted users). */
  pendingLabel?: string;
  labelForType: (type: MediaType) => string;
  gripAriaLabel: string;
  /** Optional `aria-label` on the list root (e.g. settings vs onboarding copy). */
  listAriaLabel?: string;
};

type SortableRowProps = {
  type: MediaType;
  selected: Set<MediaType>;
  onToggle: (type: MediaType) => void;
  disabled: boolean;
  labelForType: (type: MediaType) => string;
  gripAriaLabel: string;
};

function SortableRow({
  type,
  selected,
  onToggle,
  disabled,
  labelForType,
  gripAriaLabel,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: type,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-2 transition-shadow duration-150 ease-out",
        "hover:bg-[var(--color-darkest)]/80",
        "focus-within:ring-2 focus-within:ring-[var(--color-mid)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--color-dark)]",
        isDragging && "z-[1] scale-[1.02] bg-[var(--color-mid)]/15 shadow-lg ring-2 ring-[var(--btn-gradient-start)]/35"
      )}
    >
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "inline-flex min-h-10 min-w-10 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-md border-0 bg-transparent p-0",
          "text-[var(--color-light)] hover:bg-[var(--color-mid)]/25 hover:text-[var(--color-lightest)] active:cursor-grabbing",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mid)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-dark)]",
          disabled && "pointer-events-none opacity-50"
        )}
        aria-label={gripAriaLabel}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" aria-hidden />
      </button>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={selected.has(type)}
          onChange={() => onToggle(type)}
          disabled={disabled}
          className="h-4 w-4 shrink-0 rounded border-[var(--color-mid)] bg-[var(--color-darkest)] text-[var(--color-mid)] focus:ring-[var(--color-mid)]"
        />
        <span className="text-sm text-[var(--color-lightest)]">{labelForType(type)}</span>
      </label>
    </li>
  );
}

/**
 * Category reorder with **@dnd-kit/sortable**: drag uses transforms until drop, so there is no
 * live array reorder / hit-test loop (which caused flicker on web and Capacitor).
 */
export function MediaCategoryDragList({
  order,
  onReorder,
  selected,
  onToggle,
  disabled = false,
  isPending = false,
  pendingLabel,
  labelForType,
  gripAriaLabel,
  listAriaLabel,
}: MediaCategoryDragListProps) {
  const sortableDisabled = disabled || isPending;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as MediaType);
    const newIndex = order.indexOf(over.id as MediaType);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="relative isolate">
          <ul
            aria-label={listAriaLabel}
            aria-busy={isPending}
            className={cn(
              "flex flex-col gap-1 rounded-lg border border-[var(--color-mid)]/30 bg-[var(--color-darkest)]/50 p-1",
              isPending && "opacity-[0.72]"
            )}
          >
            {order.map((type) => (
              <SortableRow
                key={type}
                type={type}
                selected={selected}
                onToggle={onToggle}
                disabled={sortableDisabled}
                labelForType={labelForType}
                gripAriaLabel={gripAriaLabel}
              />
            ))}
          </ul>
          {isPending ? (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-[var(--color-darkest)]/65 backdrop-blur-[2px]"
              role="status"
              aria-live="polite"
              aria-label={pendingLabel}
            >
              <Loader2 className="h-6 w-6 shrink-0 animate-spin text-[var(--color-mid)]" aria-hidden />
              {pendingLabel ? (
                <span className="max-w-[90%] text-center text-xs font-medium text-[var(--color-lightest)]">
                  {pendingLabel}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </SortableContext>
    </DndContext>
  );
}
