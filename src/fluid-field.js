const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Bounded 2D stable-fluids velocity grid (no density texture/readback).
 * Semi-Lagrangian advection, light viscosity, then a Jacobi pressure projection.
 * Units are viewport fractions / second; callers advance at a fixed 30 Hz.
 */
export class FluidField {
  constructor(columns = 36, rows = 24) {
    this.columns = clamp(Math.round(columns), 8, 48);
    this.rows = clamp(Math.round(rows), 8, 36);
    const size = this.columns * this.rows;
    this.u = new Float32Array(size);
    this.v = new Float32Array(size);
    this.nextU = new Float32Array(size);
    this.nextV = new Float32Array(size);
    this.pressure = new Float32Array(size);
    this.nextPressure = new Float32Array(size);
    this.divergence = new Float32Array(size);
  }

  sample(values, x, y) {
    const gx = clamp(x, 0, 1) * (this.columns - 1);
    const gy = clamp(y, 0, 1) * (this.rows - 1);
    const left = Math.min(this.columns - 2, Math.floor(gx));
    const bottom = Math.min(this.rows - 2, Math.floor(gy));
    const tx = gx - left;
    const ty = gy - bottom;
    const index = bottom * this.columns + left;
    const a = values[index] * (1 - tx) + values[index + 1] * tx;
    const b = values[index + this.columns] * (1 - tx) + values[index + this.columns + 1] * tx;
    return a * (1 - ty) + b * ty;
  }

  splat(x, y, forceX, forceY, radius = 0.2, spin = 0, aspect = 1) {
    const { columns, rows, u, v } = this;
    const minX = Math.max(1, Math.floor((x - radius / aspect) * (columns - 1)));
    const maxX = Math.min(columns - 2, Math.ceil((x + radius / aspect) * (columns - 1)));
    const minY = Math.max(1, Math.floor((y - radius) * (rows - 1)));
    const maxY = Math.min(rows - 2, Math.ceil((y + radius) * (rows - 1)));
    for (let row = minY; row <= maxY; row += 1) {
      for (let col = minX; col <= maxX; col += 1) {
        const dx = (col / (columns - 1) - x) * aspect;
        const dy = row / (rows - 1) - y;
        const weight = Math.max(0, 1 - (dx * dx + dy * dy) / (radius * radius)) ** 2;
        const index = row * columns + col;
        u[index] = clamp(u[index] + (forceX - dy / radius * spin / aspect) * weight, -0.8, 0.8);
        v[index] = clamp(v[index] + (forceY + dx / radius * spin) * weight, -0.8, 0.8);
      }
    }
  }

  project() {
    const { columns: width, rows: height, u, v, divergence } = this;
    const dx = 1 / (width - 1);
    const dy = 1 / (height - 1);
    const dx2 = dx * dx;
    const dy2 = dy * dy;
    this.pressure.fill(0);
    this.nextPressure.fill(0);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        divergence[i] = (u[i + 1] - u[i - 1]) / (2 * dx)
          + (v[i + width] - v[i - width]) / (2 * dy);
      }
    }

    // Fixed iterations keep the frame cost independent of input intensity.
    for (let iteration = 0; iteration < 14; iteration += 1) {
      const p = this.pressure;
      const next = this.nextPressure;
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = y * width + x;
          next[i] = ((p[i - 1] + p[i + 1]) * dy2
            + (p[i - width] + p[i + width]) * dx2
            - divergence[i] * dx2 * dy2) / (2 * (dx2 + dy2));
        }
      }
      for (let x = 1; x < width - 1; x += 1) {
        next[x] = next[x + width];
        next[(height - 1) * width + x] = next[(height - 2) * width + x];
      }
      for (let y = 0; y < height; y += 1) {
        next[y * width] = next[y * width + 1];
        next[y * width + width - 1] = next[y * width + width - 2];
      }
      this.pressure = next;
      this.nextPressure = p;
    }

    const p = this.pressure;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        u[i] = clamp(u[i] - (p[i + 1] - p[i - 1]) / (2 * dx), -0.8, 0.8);
        v[i] = clamp(v[i] - (p[i + width] - p[i - width]) / (2 * dy), -0.8, 0.8);
      }
    }
  }

  step(delta) {
    const dt = clamp(delta, 0, 1 / 30);
    if (!dt) return;
    const { columns: width, rows: height, u, v, nextU, nextV } = this;
    const decay = Math.exp(-1.15 * dt);
    const viscosityX = 0.00008 * dt * (width - 1) ** 2;
    const viscosityY = 0.00008 * dt * (height - 1) ** 2;
    // The untouched outer cells stay zero: no flow across the viewport edge.
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        const fromX = x / (width - 1) - u[i] * dt;
        const fromY = y / (height - 1) - v[i] * dt;
        nextU[i] = (this.sample(u, fromX, fromY)
          + viscosityX * (u[i - 1] + u[i + 1] - 2 * u[i])
          + viscosityY * (u[i - width] + u[i + width] - 2 * u[i])) * decay;
        nextV[i] = (this.sample(v, fromX, fromY)
          + viscosityX * (v[i - 1] + v[i + 1] - 2 * v[i])
          + viscosityY * (v[i - width] + v[i + width] - 2 * v[i])) * decay;
      }
    }
    this.u = nextU;
    this.v = nextV;
    this.nextU = u;
    this.nextV = v;
    this.project();
  }

  clear() {
    this.u.fill(0);
    this.v.fill(0);
    this.nextU.fill(0);
    this.nextV.fill(0);
  }
}
