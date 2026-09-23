import type { PointGroup } from "signature_pad";

/**
 * Pure geometry for the resizable / rotatable signature pad.
 *
 * Strokes live in a canonical, upright "base" space (the frame they were
 * first drawn in). Every on-screen layout is a VIEW of that space: a uniform
 * scale + centering offset, optionally rotated 90° when the fullscreen pad is
 * shown in landscape over a portrait canvas. Views are always computed from
 * the base — never chained from the previous canvas size — so any sequence of
 * resizes (expand, collapse, keyboard show/hide) is lossless.
 */

export type StrokeGroup = PointGroup;

/** 0 = upright; 90 = content rotated 90° clockwise on the canvas (the signer
 *  turns the phone counter-clockwise to read it). */
export type Rotation = 0 | 90;

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface View {
  frame: Frame;
  rotation: Rotation;
  /** Canvas CSS width — needed to rotate around the canvas. */
  canvasWidth: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Fit `frame` (base space) uniformly and centered into a canvas of
 *  `canvasWidth`×`canvasHeight` CSS px shown at `rotation`. */
export function computeView(
  frame: Frame,
  canvasWidth: number,
  canvasHeight: number,
  rotation: Rotation,
): View {
  const uprightW = rotation === 90 ? canvasHeight : canvasWidth;
  const uprightH = rotation === 90 ? canvasWidth : canvasHeight;
  const scale = Math.min(uprightW / frame.width, uprightH / frame.height);
  return {
    frame,
    rotation,
    canvasWidth,
    scale,
    offsetX: (uprightW - frame.width * scale) / 2,
    offsetY: (uprightH - frame.height * scale) / 2,
  };
}

/** Thinnest pen (CSS px) a replayed stroke may shrink to. A signature drawn
 *  in the landscape pad collapses to s ≈ 0.45 inline (iPhone 13), which would
 *  otherwise thin the pen to ~0.36–1.07 px and upload a faint PNG. */
export const MIN_REPLAY_PEN_WIDTH = 0.8;

function mapGroup(
  group: StrokeGroup,
  point: (x: number, y: number) => { x: number; y: number },
  factor: number,
  widthFactor: number = factor,
): StrokeGroup {
  const t0 = group.points[0]?.time ?? 0;
  return {
    ...group,
    // Pen widths scale with the geometry, and so does Δtime: signature_pad
    // derives width from velocity = distance / Δtime, so scaling both keeps
    // the width profile — the replay is a scaled copy, not a re-inked
    // (blobby or hairline) version of the signature.
    minWidth: group.minWidth * widthFactor,
    maxWidth: group.maxWidth * widthFactor,
    dotSize: group.dotSize * widthFactor,
    points: group.points.map((p) => ({
      ...p,
      ...point(p.x, p.y),
      time: t0 + (p.time - t0) * factor,
    })),
  };
}

/** Base space → canvas CSS px for the given view. Pen widths follow the
 *  scale but are floored at {@link MIN_REPLAY_PEN_WIDTH} (min:max ratio
 *  kept). Replayed copies never go back through {@link fromView} — only
 *  freshly drawn strokes do — so the floor never leaks into the base. */
export function toView(groups: StrokeGroup[], view: View): StrokeGroup[] {
  const { frame, scale, offsetX, offsetY, rotation, canvasWidth } = view;
  return groups.map((g) => {
    const widthFactor =
      g.minWidth > 0 && g.minWidth * scale < MIN_REPLAY_PEN_WIDTH
        ? MIN_REPLAY_PEN_WIDTH / g.minWidth
        : scale;
    return mapGroup(
      g,
      (x, y) => {
        const u = (x - frame.x) * scale + offsetX;
        const v = (y - frame.y) * scale + offsetY;
        return rotation === 90 ? { x: canvasWidth - v, y: u } : { x: u, y: v };
      },
      scale,
      widthFactor,
    );
  });
}

/** Canvas CSS px → base space (exact inverse of {@link toView}). */
export function fromView(groups: StrokeGroup[], view: View): StrokeGroup[] {
  const { frame, scale, offsetX, offsetY, rotation, canvasWidth } = view;
  return groups.map((g) =>
    mapGroup(
      g,
      (x, y) => {
        const u = rotation === 90 ? y : x;
        const v = rotation === 90 ? canvasWidth - x : y;
        return {
          x: (u - offsetX) / scale + frame.x,
          y: (v - offsetY) / scale + frame.y,
        };
      },
      1 / scale,
    ),
  );
}

/** Grow `frame` to cover every point in `groups` so ink
 *  drawn outside the original frame — e.g. in the wider landscape pad — is
 *  never clipped when the view shrinks back. Returns `frame` unchanged when
 *  everything already fits. */
export function growFrame(frame: Frame, groups: StrokeGroup[]): Frame {
  let minX = frame.x;
  let minY = frame.y;
  let maxX = frame.x + frame.width;
  let maxY = frame.y + frame.height;
  // No pen-width margin: ink touching the edge of the pad (common — people
  // sign right to the border) must not grow the frame and shrink the view.
  for (const g of groups) {
    for (const p of g.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (
    minX === frame.x &&
    minY === frame.y &&
    maxX === frame.x + frame.width &&
    maxY === frame.y + frame.height
  ) {
    return frame;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
