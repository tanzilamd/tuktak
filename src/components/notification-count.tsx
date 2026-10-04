"use client";
import { createContext, use, useState, useCallback } from "react";
const CountContext = createContext<{
  count: number;
  update: (count: number) => void;
}>({ count: 0, update: () => {} });
export function NotificationCount({
  initialCount,
  children,
}: {
  initialCount: number;
  children: React.ReactNode;
}) {
  const [local, setLocal] = useState({
    source: initialCount,
    count: initialCount,
  });
  const count = local.source === initialCount ? local.count : initialCount;
  const update = useCallback(
    (value: number) => setLocal({ source: initialCount, count: value }),
    [initialCount],
  );
  return (
    <CountContext
      value={{
        count,
        update,
      }}
    >
      {children}
    </CountContext>
  );
}
export const useNotificationCount = () => use(CountContext);
