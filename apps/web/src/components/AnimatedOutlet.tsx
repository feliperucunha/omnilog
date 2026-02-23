import { useLocation, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { pageTransition } from "@/lib/animations";

export function AnimatedOutlet() {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      className="flex flex-col min-h-0 flex-1"
      {...pageTransition}
    >
      <div className="flex flex-1 flex-col min-h-0">
        <Outlet />
      </div>
    </motion.div>
  );
}
