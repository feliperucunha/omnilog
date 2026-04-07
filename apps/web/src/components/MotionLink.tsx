import { Link } from "react-router-dom";
import { motion } from "framer-motion";

/** React Router `Link` with Framer Motion gestures (avoids `motion.div` stealing taps from nested links). */
export const MotionLink = motion(Link);
