/**
 * Example p5.js sketch for the "P 5 Sketch" block.
 *
 * Sketches export a default function in p5 instance mode: every p5 call is
 * namespaced on `p` rather than on `window`, which is what lets several sketches
 * share one page without colliding. Global mode (a bare `setup()`/`draw()`) will
 * not work here.
 *
 * The canvas size comes from the block's width/height fields and is passed in as
 * `size`; create the canvas with it so the CMS controls the dimensions.
 *
 * Statics like p5.Vector aren't global in instance mode, so the p5 constructor
 * is passed in as the third argument.
 */

/**
 * @param {import("p5")} p - the p5 instance
 * @param {{ width: number, height: number }} size - canvas size from the CMS
 * @param {typeof import("p5")} p5 - the p5 constructor, for statics (p5.Vector)
 */
export default function flocking(p, size, p5) {
  /** @type {{ pos: any, vel: any }[]} */
  const boids = [];
  const COUNT = 80;
  const MAX_SPEED = 2;
  const NEIGHBOR_RADIUS = 50;
  const SEPARATION_RADIUS = 24;

  p.setup = () => {
    p.createCanvas(size.width, size.height);
    for (let i = 0; i < COUNT; i++) {
      boids.push({
        pos: p.createVector(p.random(size.width), p.random(size.height)),
        vel: p5.Vector.random2D().mult(p.random(1, MAX_SPEED)),
      });
    }
  };

  p.draw = () => {
    p.background(12, 14, 20);

    for (const boid of boids) {
      const align = p.createVector(0, 0);
      const cohere = p.createVector(0, 0);
      const separate = p.createVector(0, 0);
      let neighbors = 0;

      for (const other of boids) {
        if (other === boid) continue;
        const d = boid.pos.dist(other.pos);
        if (d > NEIGHBOR_RADIUS) continue;
        align.add(other.vel);
        cohere.add(other.pos);
        if (d < SEPARATION_RADIUS && d > 0) {
          separate.add(p5.Vector.sub(boid.pos, other.pos).div(d * d));
        }
        neighbors++;
      }

      if (neighbors > 0) {
        align.div(neighbors).setMag(MAX_SPEED).sub(boid.vel).limit(0.05);
        cohere
          .div(neighbors)
          .sub(boid.pos)
          .setMag(MAX_SPEED)
          .sub(boid.vel)
          .limit(0.05);
        boid.vel.add(align).add(cohere);
      }
      boid.vel.add(separate.mult(0.6)).limit(MAX_SPEED);
      boid.pos.add(boid.vel);

      // Wrap at the edges so the flock never leaves the canvas.
      boid.pos.x = (boid.pos.x + size.width) % size.width;
      boid.pos.y = (boid.pos.y + size.height) % size.height;

      p.noStroke();
      p.fill(237, 118, 54);
      p.circle(boid.pos.x, boid.pos.y, 4);
    }
  };
}
