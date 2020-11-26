import * as style from '../style.css';
import { startBlobs } from './meta';

/**
 * Control point x,y - point x,y - control point x,y
 */
export type BlobPoint = [number, number, number, number, number, number];

const maxPointDistance = 0.25;

function randomisePoint(point: BlobPoint): BlobPoint {
  const distance = Math.random() * maxPointDistance;
  const angle = Math.random() * Math.PI * 2;
  const xShift = Math.sin(angle) * distance;
  const yShift = Math.cos(angle) * distance;
  return [
    point[0] + xShift,
    point[1] + yShift,
    point[2] + xShift,
    point[3] + yShift,
    point[4] + xShift,
    point[5] + yShift,
  ];
}

function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

interface CircleBlobPointState {
  basePoint: BlobPoint;
  pos: number;
  duration: number;
  startPoint: BlobPoint;
  endPoint: BlobPoint;
}

/** Bezier points for a seven point circle, to 3 decimal places */
const sevenPointCircle: BlobPoint[] = [
  [-0.304, -1, 0, -1, 0.304, -1],
  [0.592, -0.861, 0.782, -0.623, 0.972, -0.386],
  [1.043, -0.074, 0.975, 0.223, 0.907, 0.519],
  [0.708, 0.769, 0.434, 0.901, 0.16, 1.033],
  [-0.16, 1.033, -0.434, 0.901, -0.708, 0.769],
  [-0.907, 0.519, -0.975, 0.223, -1.043, -0.074],
  [-0.972, -0.386, -0.782, -0.623, -0.592, -0.861],
];

/*
// Should it be needed, here's how the above was created:
function createBezierCirclePoints(points: number): BlobPoint[] {
  const anglePerPoint = 360 / points;
  const matrix = new DOMMatrix();
  const point = new DOMPoint();
  const controlDistance = (4 / 3) * Math.tan(Math.PI / (2 * points));
  return Array.from({ length: points }, (_, i) => {
    point.x = -controlDistance;
    point.y = -1;
    const cp1 = point.matrixTransform(matrix);
    point.x = 0;
    point.y = -1;
    const p = point.matrixTransform(matrix);
    point.x = controlDistance;
    point.y = -1;
    const cp2 = point.matrixTransform(matrix);
    const basePoint: BlobPoint = [cp1.x, cp1.y, p.x, p.y, cp2.x, cp2.y];
    matrix.rotateSelf(0, 0, anglePerPoint);
    return basePoint;
  });
}
*/

interface CircleBlobOptions {
  minDuration?: number;
  maxDuration?: number;
  startPoints?: BlobPoint[];
}

class CircleBlob {
  private animStates: CircleBlobPointState[];
  private minDuration: number;
  private maxDuration: number;
  public points: BlobPoint[];

  constructor(
    basePoints: BlobPoint[],
    {
      startPoints = basePoints.map((point) => randomisePoint(point)),
      minDuration = 4000,
      maxDuration = 11000,
    }: CircleBlobOptions = {},
  ) {
    this.points = startPoints;
    this.minDuration = minDuration;
    this.maxDuration = maxDuration;
    this.animStates = basePoints.map((basePoint, i) => ({
      basePoint,
      pos: 0,
      duration: rand(minDuration, maxDuration),
      startPoint: startPoints[i],
      endPoint: randomisePoint(basePoint),
    }));
  }

  advance(timeDelta: number): void {
    this.points = this.animStates.map((animState) => {
      animState.pos += timeDelta / animState.duration;
      if (animState.pos >= 1) {
        animState.startPoint = animState.endPoint;
        animState.pos = 0;
        animState.duration = rand(this.minDuration, this.maxDuration);
        animState.endPoint = randomisePoint(animState.basePoint);
      }
      const eased = easeInOutQuad(animState.pos);

      const point = animState.startPoint.map((startPoint, i) => {
        const endPoint = animState.endPoint[i];
        return (endPoint - startPoint) * eased + startPoint;
      }) as BlobPoint;

      return point;
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    const points = this.points;
    ctx.beginPath();
    ctx.moveTo(points[0][2], points[0][3]);

    for (let i = 0; i < points.length; i++) {
      const nextI = i === points.length - 1 ? 0 : i + 1;
      ctx.bezierCurveTo(
        points[i][4],
        points[i][5],
        points[nextI][0],
        points[nextI][1],
        points[nextI][2],
        points[nextI][3],
      );
    }

    ctx.closePath();
    ctx.fill();
  }
}

const centralBlobsRotationTime = 120000;

class CentralBlobs {
  private rotatePos: number = 0;
  private blobs = Array.from(
    { length: 4 },
    (_, i) => new CircleBlob(sevenPointCircle, { startPoints: startBlobs[i] }),
  );

  constructor() {
    console.log(
      `WARNING: There's a debug key listener here that must be removed before going live - also change CircleBlob.points to private`,
    );
    addEventListener('keyup', (event) => {
      if (event.key !== 'b') return;
      console.log(
        JSON.stringify(
          this.blobs.map((blob) =>
            blob.points.map((points) =>
              points.map((point) => Number(point.toFixed(3))),
            ),
          ),
        ),
      );
    });
  }

  advance(timeDelta: number) {
    this.rotatePos =
      (this.rotatePos + timeDelta / centralBlobsRotationTime) % 1;
    for (const blob of this.blobs) blob.advance(timeDelta);
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radius, radius);
    ctx.rotate(Math.PI * 2 * this.rotatePos);
    for (const blob of this.blobs) blob.draw(ctx);
    ctx.restore();
  }
}

const bgBlobsMinRadius = 20;
const bgBlobsMaxRadius = 60;
const bgBlobsMinAlpha = 0.1;
const bgBlobsMaxAlpha = 0.8;
const bgBlobsGridSize = 200;
const bgBlobsMinSpinTime = 20000;
const bgBlobsMaxSpinTime = 60000;
const bgBlobsMinVelocity = 0.005;
const bgBlobsMaxVelocity = 0.02;

interface BackgroundBlob {
  blob: CircleBlob;
  velocity: number;
  spinTime: number;
  alpha: number;
  rotatePos: number;
  radius: number;
  x: number;
  y: number;
}

const bgBlobsAlphaTime = 2000;

class BackgroundBlobs {
  private bgBlobs: BackgroundBlob[] = [];
  private overallAlphaPos = 0;

  constructor(bounds: DOMRect) {
    for (let x = 0; x < bounds.width; x += bgBlobsGridSize) {
      for (let y = 0; y < bounds.height; y += bgBlobsGridSize) {
        this.bgBlobs.push({
          blob: new CircleBlob(sevenPointCircle, {
            minDuration: 2000,
            maxDuration: 5000,
          }),
          velocity:
            Math.random() * (bgBlobsMaxVelocity - bgBlobsMinVelocity) +
            bgBlobsMinVelocity,
          alpha:
            Math.random() ** 3 * (bgBlobsMaxAlpha - bgBlobsMinAlpha) +
            bgBlobsMinAlpha,
          spinTime:
            Math.random() * (bgBlobsMaxSpinTime - bgBlobsMinSpinTime) +
            bgBlobsMinSpinTime,
          rotatePos: 0,
          radius:
            Math.random() ** 3 * (bgBlobsMaxRadius - bgBlobsMinRadius) +
            bgBlobsMinRadius,
          x: Math.random() * bgBlobsGridSize + x,
          y: Math.random() * bgBlobsGridSize + y,
        });
      }
    }
  }

  advance(
    timeDelta: number,
    bounds: DOMRect,
    targetX: number,
    targetY: number,
  ) {
    if (this.overallAlphaPos !== 1) {
      this.overallAlphaPos = Math.min(
        1,
        this.overallAlphaPos + timeDelta / bgBlobsAlphaTime,
      );
    }
    for (const bgBlob of this.bgBlobs) {
      bgBlob.blob.advance(timeDelta);
      const dist = Math.hypot(bgBlob.x - targetX, bgBlob.y - targetY);
      bgBlob.rotatePos = (bgBlob.rotatePos + timeDelta / bgBlob.spinTime) % 1;
      const shiftDist = bgBlob.velocity * timeDelta;

      if (dist < 10) {
        // Move the circle out to a random edge
        const tlbr = Math.floor(Math.random() * 4);
        switch (tlbr) {
          case 0: // top
            bgBlob.x = Math.random() * bounds.width;
            bgBlob.y = -(bgBlob.radius * (1 + maxPointDistance));
            break;
          case 1: // left
            bgBlob.x = -(bgBlob.radius * (1 + maxPointDistance));
            bgBlob.y = Math.random() * bounds.height;
            break;
          case 2: // bottom
            bgBlob.x = Math.random() * bounds.width;
            bgBlob.y = bounds.height + bgBlob.radius * (1 + maxPointDistance);
            break;
          case 3: // right
            bgBlob.x = bounds.width + bgBlob.radius * (1 + maxPointDistance);
            bgBlob.y = Math.random() * bounds.height;
            break;
        }
      }

      const direction = Math.atan2(targetX - bgBlob.x, targetY - bgBlob.y);
      const xShift = Math.sin(direction) * shiftDist;
      const yShift = Math.cos(direction) * shiftDist;
      bgBlob.x += xShift;
      bgBlob.y += yShift;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const overallAlpha = easeInOutQuad(this.overallAlphaPos);

    for (const bgBlob of this.bgBlobs) {
      ctx.save();
      ctx.globalAlpha = bgBlob.alpha * overallAlpha;
      ctx.translate(bgBlob.x, bgBlob.y);
      ctx.scale(bgBlob.radius, bgBlob.radius);
      ctx.rotate(Math.PI * 2 * bgBlob.rotatePos);
      bgBlob.blob.draw(ctx);
      ctx.restore();
    }
  }
}

const deltaMultiplierStep = 0.01;

export function startBlobAnim(canvas: HTMLCanvasElement) {
  let lastTime: number;
  const ctx = canvas.getContext('2d')!;
  const centralBlobs = new CentralBlobs();
  let backgroundBlobs: BackgroundBlobs;
  const loadImgEl = document.querySelector('.' + style.loadImg)!;
  let deltaMultiplier = 1;
  let hasFocus = true;
  let animating = true;

  const focusListener = () => {
    hasFocus = true;
    if (!animating) startAnim();
  };
  const blurListener = () => {
    hasFocus = false;
  };

  new ResizeObserver(() => {
    // Redraw for new canvas size
    if (!animating) drawFrame(0);
  }).observe(canvas);

  addEventListener('focus', focusListener);
  addEventListener('blur', blurListener);

  function destruct() {
    removeEventListener('focus', focusListener);
    removeEventListener('blur', blurListener);
  }

  function drawFrame(delta: number) {
    const canvasBounds = canvas.getBoundingClientRect();
    canvas.width = canvasBounds.width * devicePixelRatio;
    canvas.height = canvasBounds.height * devicePixelRatio;
    const loadImgBounds = loadImgEl.getBoundingClientRect();
    const computedStyles = getComputedStyle(canvas);
    const blobPink = computedStyles.getPropertyValue('--blob-pink');
    const loadImgCenterX =
      loadImgBounds.left - canvasBounds.left + loadImgBounds.width / 2;
    const loadImgCenterY =
      loadImgBounds.top - canvasBounds.top + loadImgBounds.height / 2;

    ctx.scale(devicePixelRatio, devicePixelRatio);

    if (!backgroundBlobs) backgroundBlobs = new BackgroundBlobs(canvasBounds);
    backgroundBlobs.advance(
      delta,
      canvasBounds,
      loadImgCenterX,
      loadImgCenterY,
    );
    centralBlobs.advance(delta);

    ctx.globalAlpha = Number(
      computedStyles.getPropertyValue('--center-blob-opacity'),
    );
    ctx.fillStyle = blobPink;

    backgroundBlobs.draw(ctx);

    centralBlobs.draw(
      ctx,
      loadImgCenterX,
      loadImgCenterY,
      loadImgBounds.height / 2 / (1 + maxPointDistance),
    );
  }

  function frame(time: number) {
    // Stop the loop if the canvas is gone
    if (!canvas.isConnected) {
      destruct();
      return;
    }

    // Be kind: If the window isn't focused, bring the animation to a stop.
    if (!hasFocus) {
      // Bring the anim to a slow stop
      deltaMultiplier = Math.max(0, deltaMultiplier - deltaMultiplierStep);
      if (deltaMultiplier === 0) {
        animating = false;
        return;
      }
    } else if (deltaMultiplier !== 1) {
      deltaMultiplier = Math.min(1, deltaMultiplier + deltaMultiplierStep);
    }

    const delta = (time - lastTime) * deltaMultiplier;
    lastTime = time;

    drawFrame(delta);

    requestAnimationFrame(frame);
  }

  function startAnim() {
    animating = true;
    requestAnimationFrame((time: number) => {
      lastTime = time;
      frame(time);
    });
  }

  startAnim();
}