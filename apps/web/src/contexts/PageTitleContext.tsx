import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface PageTitleContextValue {
  pageTitle: string | null;
  setPageTitle: (title: string | null) => void;
  rightSlot: ReactNode;
  setRightSlot: (node: ReactNode) => void;
  /** Control rendered on the same row as the in-page heading. */
  headingAction: ReactNode;
  setHeadingAction: (node: ReactNode) => void;
  /** Full-width bar below navbar (no padding). Used for category strip on Home/Search. */
  belowNavbar: ReactNode;
  setBelowNavbar: (node: ReactNode) => void;
}

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [pageTitle, setPageTitleState] = useState<string | null>(null);
  const [rightSlot, setRightSlotState] = useState<ReactNode>(null);
  const [headingAction, setHeadingActionState] = useState<ReactNode>(null);
  const [belowNavbar, setBelowNavbarState] = useState<ReactNode>(null);

  const setPageTitle = useCallback((title: string | null) => {
    setPageTitleState(title);
  }, []);

  const setRightSlot = useCallback((node: ReactNode) => {
    setRightSlotState(node);
  }, []);

  const setHeadingAction = useCallback((node: ReactNode) => {
    setHeadingActionState(node);
  }, []);

  const setBelowNavbar = useCallback((node: ReactNode) => {
    setBelowNavbarState(node);
  }, []);

  return (
    <PageTitleContext.Provider
      value={{
        pageTitle,
        setPageTitle,
        rightSlot,
        setRightSlot,
        headingAction,
        setHeadingAction,
        belowNavbar,
        setBelowNavbar,
      }}
    >
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle() {
  return useContext(PageTitleContext);
}
