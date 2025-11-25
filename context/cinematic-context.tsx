"use client";

import { createContext, useContext } from "react";

export type CinematicContextValue = {
  hasNextPrompt: boolean;
  isSendingPrompt: boolean;
  nextPromptLabel: string | null;
  sendNextPrompt: () => Promise<void>;
};

const CinematicContext = createContext<CinematicContextValue | null>(null);

export const CinematicProvider = CinematicContext.Provider;

export const useCinematicContext = () => {
  const context = useContext(CinematicContext);

  if (!context) {
    throw new Error(
      "useCinematicContext must be used within a CinematicProvider",
    );
  }

  return context;
};

export const useOptionalCinematicContext = () => {
  return useContext(CinematicContext);
};

