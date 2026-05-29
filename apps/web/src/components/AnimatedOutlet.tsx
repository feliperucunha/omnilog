import { useLocation, Outlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { pageTransition } from "@/lib/animations";
import { getMainNavTransitionKey } from "@/lib/mainNav";

export function AnimatedOutlet() {
  const location = useLocation();
  const transitionKey = getMainNavTransitionKey(location.pathname);
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={transitionKey}
        className="flex min-h-0 flex-1 flex-col"
        {...pageTransition}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
