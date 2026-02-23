/**
 * iOS-like animation config: smooth springs and short durations.
 * Use for page transitions, list items, modals, and interactive feedback.
 */
export const spring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
};

export const springSoft = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

export const tweenFast = {
  type: "tween" as const,
  duration: 0.2,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

export const tweenMedium = {
  type: "tween" as const,
  duration: 0.35,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

/** Page/content enter: slight fade + slide up */
export const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const pageTransition = {
  initial: "initial",
  animate: "animate",
  exit: "exit",
  variants: pageVariants,
  transition: springSoft,
};

/** List item stagger */
export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: springSoft,
};

/** Button/card tap feedback */
export const tapScale = { scale: 0.97 };
export const tapTransition = tweenFast;

/** Modal overlay and content */
export const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: tweenFast,
};

export const modalContentVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: spring,
};
