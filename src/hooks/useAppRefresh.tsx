import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface AppRefreshContextValue {
  refreshToken: number;
  refresh: () => void;
}

const AppRefreshContext = createContext<AppRefreshContextValue | undefined>(undefined);

export const AppRefreshProvider = ({ children }: { children: React.ReactNode }) => {
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const value = useMemo(() => ({ refreshToken, refresh }), [refreshToken, refresh]);

  return <AppRefreshContext.Provider value={value}>{children}</AppRefreshContext.Provider>;
};

export const useAppRefresh = (): AppRefreshContextValue => {
  const context = useContext(AppRefreshContext);

  if (!context) {
    throw new Error('useAppRefresh must be used inside AppRefreshProvider.');
  }

  return context;
};
