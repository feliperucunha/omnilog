import { staggerContainer, staggerItem } from "@/lib/animations";

export const listStaggerParentProps = {
  variants: staggerContainer,
  initial: false as const,
  animate: "animate" as const,
};

export const listStaggerItemVariants = staggerItem;

export const listStaggerItemClassName = "list-stagger-item";

export const routeOutletClassName = "motion-route-outlet";

export const visibleEnterProps = {
  initial: false as const,
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0 },
};
