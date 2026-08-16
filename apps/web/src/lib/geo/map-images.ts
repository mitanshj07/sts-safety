// apps/web/src/lib/geo/map-images.ts
import type { Map as MapLibreMap } from "maplibre-gl";

import { mapHasStyle } from "@/lib/geo/map-runtime";

export const TOURIST_DOT_IMAGE_ID = "sts-tourist-dot";
export const INCIDENT_PIN_IMAGE_ID = "sts-incident-pin";

function canvasImageData(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  draw(ctx, size);
  return ctx.getImageData(0, 0, size, size);
}

function drawDot(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
}

function drawPin(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  const cx = size / 2;
  const headR = size * 0.28;
  const headY = size * 0.38;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.72, headY + headR * 0.35);
  ctx.lineTo(cx, size - 3);
  ctx.lineTo(cx + headR * 0.72, headY + headR * 0.35);
  ctx.closePath();
  ctx.fill();
}

export function ensureMapImages(map: MapLibreMap): void {
  if (!mapHasStyle(map) || typeof document === "undefined") {
    return;
  }

  if (!map.hasImage(TOURIST_DOT_IMAGE_ID)) {
    const dot = canvasImageData(64, drawDot);
    if (dot) {
      map.addImage(TOURIST_DOT_IMAGE_ID, dot, { pixelRatio: 2, sdf: true });
    }
  }

  if (!map.hasImage(INCIDENT_PIN_IMAGE_ID)) {
    const pin = canvasImageData(64, drawPin);
    if (pin) {
      map.addImage(INCIDENT_PIN_IMAGE_ID, pin, { pixelRatio: 2, sdf: true });
    }
  }
}
