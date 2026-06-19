import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import type { BoardGameMatchCompleteState } from "@/lib/boardGameMatchComplete";
import { BoardGameMatchCompleteModal } from "@/components/BoardGameMatchCompleteModal";

interface BoardGameMatchCompleteContextValue {
  showBoardGameMatchComplete: (state: BoardGameMatchCompleteState, onDismiss?: () => void) => void;
  closeBoardGameMatchComplete: () => void;
}

const BoardGameMatchCompleteContext = createContext<BoardGameMatchCompleteContextValue | null>(null);

export function useBoardGameMatchComplete(): BoardGameMatchCompleteContextValue {
  const ctx = useContext(BoardGameMatchCompleteContext);
  if (!ctx) throw new Error("useBoardGameMatchComplete must be used within BoardGameMatchCompleteProvider");
  return ctx;
}

export function BoardGameMatchCompleteProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BoardGameMatchCompleteState | null>(null);
  const onDismissRef = useRef<(() => void) | undefined>(undefined);

  const showBoardGameMatchComplete = useCallback((s: BoardGameMatchCompleteState, dismiss?: () => void) => {
    onDismissRef.current = dismiss;
    setState(s);
  }, []);

  const closeBoardGameMatchComplete = useCallback(() => {
    const dismiss = onDismissRef.current;
    onDismissRef.current = undefined;
    setState(null);
    dismiss?.();
  }, []);

  return (
    <BoardGameMatchCompleteContext.Provider value={{ showBoardGameMatchComplete, closeBoardGameMatchComplete }}>
      {children}
      <AnimatePresence mode="wait">
        {state != null && (
          <BoardGameMatchCompleteModal key="board-game-match-complete" state={state} onClose={closeBoardGameMatchComplete} />
        )}
      </AnimatePresence>
    </BoardGameMatchCompleteContext.Provider>
  );
}
