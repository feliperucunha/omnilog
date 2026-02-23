import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { MEDIA_TYPES, type MediaType } from "@logeverything/shared";
import { useAuth } from "@/contexts/AuthContext";
import { useMe } from "@/contexts/MeContext";

interface VisibleMediaTypesContextValue {
  visibleTypes: MediaType[];
  refetch: () => Promise<void>;
  loading: boolean;
}

const VisibleMediaTypesContext = createContext<VisibleMediaTypesContextValue | null>(null);

export function VisibleMediaTypesProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { me, refetch, loading } = useMe();

  const value = useMemo(() => {
    const types =
      token && me?.visibleMediaTypes?.length
        ? (me.visibleMediaTypes as MediaType[]).filter((t) => MEDIA_TYPES.includes(t))
        : [...MEDIA_TYPES];
    return {
      visibleTypes: types.length > 0 ? types : [...MEDIA_TYPES],
      refetch,
      loading,
    };
  }, [token, me?.visibleMediaTypes, refetch, loading]);

  return (
    <VisibleMediaTypesContext.Provider value={value}>
      {children}
    </VisibleMediaTypesContext.Provider>
  );
}

export function useVisibleMediaTypes(): VisibleMediaTypesContextValue {
  const ctx = useContext(VisibleMediaTypesContext);
  if (!ctx) throw new Error("useVisibleMediaTypes must be used within VisibleMediaTypesProvider");
  return ctx;
}
