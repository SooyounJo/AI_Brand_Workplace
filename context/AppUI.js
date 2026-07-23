import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/router";

const AppUIContext = createContext(null);
const BOARD_LOAD_MS = 3000;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function AppUIProvider({ children }) {
  const router = useRouter();
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [boardLoading, setBoardLoading] = useState(false);
  const navigatingRef = useRef(false);

  const openNewProject = useCallback(() => setNewProjectOpen(true), []);
  const closeNewProject = useCallback(() => setNewProjectOpen(false), []);

  const goToBoard = useCallback(
    async (href) => {
      if (!href || navigatingRef.current) return;
      if (router.asPath === href) return;

      navigatingRef.current = true;
      setBoardLoading(true);

      try {
        await wait(BOARD_LOAD_MS);
        await router.push(href);
      } finally {
        setBoardLoading(false);
        navigatingRef.current = false;
      }
    },
    [router]
  );

  const value = useMemo(
    () => ({
      newProjectOpen,
      openNewProject,
      closeNewProject,
      boardLoading,
      goToBoard,
      boardLoadMs: BOARD_LOAD_MS,
    }),
    [newProjectOpen, openNewProject, closeNewProject, boardLoading, goToBoard]
  );

  return (
    <AppUIContext.Provider value={value}>{children}</AppUIContext.Provider>
  );
}

export function useAppUI() {
  const ctx = useContext(AppUIContext);
  if (!ctx) {
    throw new Error("useAppUI must be used within AppUIProvider");
  }
  return ctx;
}
