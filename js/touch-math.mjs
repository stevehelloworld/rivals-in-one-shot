export function clampStick(dx, dy, radius) {
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001) return { x: 0, y: 0, dx: 0, dy: 0 };
  const clampedDistance = Math.min(radius, distance);
  const visualX = (dx / distance) * clampedDistance;
  const visualY = (dy / distance) * clampedDistance;
  const normalized = clampedDistance / radius;
  const deadzone = 0.12;
  const strength = normalized <= deadzone ? 0 : (normalized - deadzone) / (1 - deadzone);
  return {
    x: (dx / distance) * strength,
    y: (dy / distance) * strength,
    dx: visualX,
    dy: visualY,
  };
}
