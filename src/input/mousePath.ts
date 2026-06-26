export type MouseStep = { delayMs: number; dx: number; dy: number };

const random = (min: number, max: number) =>
  min + Math.random() * (max - min);

const ease = (value: number) =>
  value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;

export const createHumanMousePath = (dx: number, dy: number) => {
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return [];
  const steps = Math.max(8, Math.min(64, Math.round(distance / 8)));
  let prevX = 0;
  let prevY = 0;
  let sentX = 0;
  let sentY = 0;
  const output: MouseStep[] = [];
  for (let index = 1; index <= steps; index += 1) {
    const progress = ease(index / steps);
    const curve = Math.sin(progress * Math.PI) * random(-distance * 0.04, distance * 0.04);
    const x = dx * progress + curve * (-dy / Math.max(distance, 1));
    const y = dy * progress + curve * (dx / Math.max(distance, 1));
    const sx = Math.round(x - prevX);
    const sy = Math.round(y - prevY);
    prevX += sx;
    prevY += sy;
    sentX += sx;
    sentY += sy;
    output.push({ delayMs: Math.round(random(3, 10)), dx: sx, dy: sy });
  }
  output.push({ delayMs: 2, dx: Math.round(dx - sentX), dy: Math.round(dy - sentY) });
  return output.filter((step) => step.dx || step.dy);
};
