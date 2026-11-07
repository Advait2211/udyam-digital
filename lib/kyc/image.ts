"use client";

import type { Worker } from "tesseract.js";

/**
 * On-device document processing: quality check → auto-straighten → OCR.
 * Images never leave the phone; only extracted fields are sent for verification.
 */

export interface Quality {
  blur: number;
  blurry: boolean;
  skewDeg: number;
  textFound: boolean;
}

export const BLUR_THRESHOLD = 60; // Laplacian variance on a 700px-wide grayscale copy (calibrated on the specimen set)

export async function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return img;
}

function toCanvas(img: CanvasImageSource & { width: number; height: number }, maxW: number) {
  const scale = Math.min(1, maxW / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function gray(c: HTMLCanvasElement) {
  const { data } = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);
  const g = new Float32Array(c.width * c.height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) g[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return g;
}

/** Sharpness = variance of the Laplacian. Low variance → blurry photo. */
export function blurScore(img: HTMLImageElement) {
  const c = toCanvas(img, 700);
  const g = gray(c);
  const w = c.width, h = c.height;
  let sum = 0, sq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      sum += lap;
      sq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return sq / n - mean * mean;
}

/** Finds text tilt by maximising the row-projection variance of dark pixels. Returns degrees (+ = clockwise tilt). */
export function skewAngle(img: HTMLImageElement) {
  const c = toCanvas(img, 520);
  const g = gray(c);
  const w = c.width, h = c.height;
  const pts: number[] = [];
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (g[y * w + x] < 110) pts.push(x, y);
  if (pts.length < 200) return 0;
  let best = 0, bestScore = -1;
  for (let deg = -10; deg <= 10.001; deg += 0.25) {
    const a = (deg * Math.PI) / 180, s = Math.sin(a), co = Math.cos(a);
    const bins = new Float32Array(h * 2 + w);
    for (let i = 0; i < pts.length; i += 2) {
      const yy = Math.round(pts[i + 1] * co - pts[i] * s) + w;
      bins[yy]++;
    }
    let score = 0;
    for (let i = 0; i < bins.length; i++) score += bins[i] * bins[i];
    if (score > bestScore) { bestScore = score; best = deg; }
  }
  return best;
}

export function straighten(img: HTMLImageElement, deg: number): HTMLCanvasElement {
  const a = (-deg * Math.PI) / 180;
  const s = Math.abs(Math.sin(a)), co = Math.abs(Math.cos(a));
  const w = img.width, h = img.height;
  const c = document.createElement("canvas");
  c.width = Math.round(w * co + h * s);
  c.height = Math.round(w * s + h * co);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(a);
  ctx.drawImage(img, -w / 2, -h / 2);
  return c;
}

let workerPromise: Promise<Worker> | null = null;

/** One shared OCR worker, self-hosted (no CDN), warmed up before the owner reaches the upload step. */
export function getOcr(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      const w = await createWorker("eng", 1, {
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/core",
        langPath: "/tesseract/lang",
        gzip: true,
      });
      await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
      return w;
    })();
    workerPromise.catch(() => (workerPromise = null));
  }
  return workerPromise;
}

export type Stage = "checking" | "straightening" | "reading" | "done";

export async function processDocument(file: Blob, onStage: (s: Stage, progress: number) => void): Promise<{ text: string; quality: Quality; confidence: number; preview: string }> {
  onStage("checking", 0.1);
  const img = await loadImage(file);
  const blur = blurScore(img);
  const blurry = blur < BLUR_THRESHOLD;
  let skewDeg = 0;
  let source: HTMLImageElement | HTMLCanvasElement = img;
  if (!blurry) {
    skewDeg = skewAngle(img);
    if (Math.abs(skewDeg) >= 1.5) {
      onStage("straightening", 0.3);
      source = straighten(img, skewDeg);
    }
  }
  onStage("reading", 0.45);
  const worker = await getOcr();
  const { data } = await worker.recognize(source as HTMLCanvasElement);
  onStage("done", 1);
  const preview = source instanceof HTMLCanvasElement ? source.toDataURL("image/jpeg", 0.6) : URL.createObjectURL(file);
  return { text: data.text ?? "", confidence: data.confidence ?? 0, quality: { blur: Math.round(blur), blurry, skewDeg, textFound: (data.text ?? "").trim().length > 20 }, preview };
}
