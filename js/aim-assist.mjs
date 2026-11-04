const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const strength = { low: 0.25, standard: 0.45, strong: 0.6 };

// Work in camera angles, not hitboxes: bullets still use the normal raycast.
export function assistLook({ yaw, pitch, dx, dy, zoom = 1, level, pull, targets, visible }) {
  const amount = strength[level];
  const movement = Math.hypot(dx, dy);
  if (!amount || !movement || movement > 0.15) return null;
  const cone = 0.115 / Math.sqrt(zoom);
  let best = null;
  for (const target of targets) {
    const yawError = wrap(target.yaw - yaw);
    const pitchError = target.pitch - pitch;
    const error = Math.hypot(yawError, pitchError);
    if (error >= cone || (best && error >= best.error) || !visible(target)) continue;
    best = { yawError, pitchError, error };
  }
  if (!best) return null;
  const weight = (1 - best.error / cone) * amount;
  const slowdown = 1 - weight;
  const correction = pull && best.error > 0 ? Math.min(weight * movement * 0.65, best.error * 0.3, 0.004) / best.error : 0;
  return { dx: dx * slowdown + best.yawError * correction, dy: dy * slowdown + best.pitchError * correction };
}
