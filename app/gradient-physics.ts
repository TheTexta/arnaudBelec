export type CollisionBounds = {
  width: number;
  height: number;
  photo: { left: number; top: number; right: number; bottom: number };
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

// The visible center marker is the collider. Its diffuse glow can spill behind
// the photo, which sits above the gradients in the stacking order.
const radius = 10;

export function containParticle(particle: Particle, bounds: CollisionBounds) {
  if (particle.x < radius) {
    particle.x = radius;
    particle.vx = Math.abs(particle.vx);
  } else if (particle.x > bounds.width - radius) {
    particle.x = bounds.width - radius;
    particle.vx = -Math.abs(particle.vx);
  }

  if (particle.y < radius) {
    particle.y = radius;
    particle.vy = Math.abs(particle.vy);
  } else if (particle.y > bounds.height - radius) {
    particle.y = bounds.height - radius;
    particle.vy = -Math.abs(particle.vy);
  }

  const { photo } = bounds;
  const nearestX = Math.max(photo.left, Math.min(particle.x, photo.right));
  const nearestY = Math.max(photo.top, Math.min(particle.y, photo.bottom));
  const dx = particle.x - nearestX;
  const dy = particle.y - nearestY;
  const distance = Math.hypot(dx, dy);

  if (distance >= radius) return;

  if (distance > 0) {
    const normalX = dx / distance;
    const normalY = dy / distance;
    particle.x += normalX * (radius - distance);
    particle.y += normalY * (radius - distance);

    const inwardSpeed = particle.vx * normalX + particle.vy * normalY;
    if (inwardSpeed < 0) {
      particle.vx -= 2 * inwardSpeed * normalX;
      particle.vy -= 2 * inwardSpeed * normalY;
    }
    return;
  }

  // A resize can put a center inside the photo. Move it to the nearest side.
  const exits = [
    { distance: particle.x - (photo.left - radius), axis: "x", value: photo.left - radius, direction: -1 },
    { distance: photo.right + radius - particle.x, axis: "x", value: photo.right + radius, direction: 1 },
    { distance: particle.y - (photo.top - radius), axis: "y", value: photo.top - radius, direction: -1 },
    { distance: photo.bottom + radius - particle.y, axis: "y", value: photo.bottom + radius, direction: 1 },
  ] as const;
  const exit = exits
    .filter(({ axis, value }) => axis === "x"
      ? value >= radius && value <= bounds.width - radius
      : value >= radius && value <= bounds.height - radius)
    .sort((a, b) => a.distance - b.distance)[0];

  if (!exit) return;
  if (exit.axis === "x") {
    particle.x = exit.value;
    particle.vx = exit.direction * Math.abs(particle.vx);
  } else {
    particle.y = exit.value;
    particle.vy = exit.direction * Math.abs(particle.vy);
  }
}

export function advanceParticle(particle: Particle, bounds: CollisionBounds, deltaMs: number) {
  const seconds = Math.min(Math.max(deltaMs, 0), 50) / 1000;
  particle.x += particle.vx * seconds;
  particle.y += particle.vy * seconds;
  containParticle(particle, bounds);
}
