import { createContext, useContext } from 'react';
import { useUpdateCheck } from '../hooks/useUpdateCheck';

type UpdateContextType = ReturnType<typeof useUpdateCheck>;

const UpdateContext = createContext<UpdateContextType | null>(null);

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const value = useUpdateCheck();
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdate(): UpdateContextType {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error('useUpdate must be used within UpdateProvider');
  return ctx;
}
