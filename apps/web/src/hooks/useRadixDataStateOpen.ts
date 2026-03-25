import { useCallback, useLayoutEffect, useState } from "react";

/**
 * Tracks Radix Dialog/Sheet content `data-state="open" | "closed"` so Android overlay-back
 * only registers while the surface is actually open (not during unmount or after close).
 */
export function useRadixDataStateOpenRef<T extends HTMLElement>(): [React.RefCallback<T>, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!node) {
      setOpen(false);
      return;
    }
    const sync = () => setOpen(node.getAttribute("data-state") === "open");
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(node, { attributes: true, attributeFilter: ["data-state"] });
    return () => mo.disconnect();
  }, [node]);

  const refCallback = useCallback((el: T | null) => {
    setNode(el);
  }, []);

  return [refCallback, open];
}

export function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value);
      else if (ref && typeof ref === "object" && "current" in ref) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    }
  };
}
