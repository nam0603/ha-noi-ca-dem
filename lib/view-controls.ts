/** Stored mouse/touch pitch uses the visible camera range, so reversal has no dead band. */
export const VIEW_PITCH_LIMITS = {
  first: { min: -1.35, max: 1.05 },
  third: { min: -0.84, max: 0.41 },
} as const;

export function clampViewPitch(pitch: number, view: 'first' | 'third') {
  const limits = VIEW_PITCH_LIMITS[view];
  return Math.max(
    limits.min,
    Math.min(limits.max, Number.isNaN(pitch) ? -0.05 : pitch),
  );
}
