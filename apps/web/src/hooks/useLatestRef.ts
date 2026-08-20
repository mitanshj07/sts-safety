"use client";

import { useEffect, useRef } from "react";

/** Keep a ref pointed at the latest value without updating it during render. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
