// apps/web/src/lib/geo/pmtiles.ts
import { addProtocol, removeProtocol } from "maplibre-gl";
import { Protocol } from "pmtiles";

let registered = false;

/**
 * Registers the `pmtiles://` protocol once per browser runtime.
 * Safe to call from MapCanvas on every mount (StrictMode included).
 */
export function registerPmtilesProtocol(): void {
  if (registered || typeof window === "undefined") {
    return;
  }

  const protocol = new Protocol();
  addProtocol("pmtiles", (requestParameters, abortController) =>
    protocol.tilev4(requestParameters, abortController),
  );
  registered = true;
}

export function unregisterPmtilesProtocol(): void {
  if (!registered || typeof window === "undefined") {
    return;
  }
  removeProtocol("pmtiles");
  registered = false;
}

export function isPmtilesProtocolRegistered(): boolean {
  return registered;
}
