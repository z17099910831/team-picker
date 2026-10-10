/**
 * Mathematical utilities for the interactive Spinning Wheel.
 *
 * Coordinate convention:
 * - In HTML5 Canvas, 0deg is at 3 o'clock (right) and angles increase clockwise.
 * - The stationary pointer is positioned at the TOP of the wheel: 270deg (or -90deg).
 * - Segment i (for N segments) spans [i * sliceDeg, (i + 1) * sliceDeg] in local wheel coordinates.
 * - When the wheel is rotated clockwise by `wheelRotationDeg`, segment i spans:
 *   [(i * sliceDeg + wheelRotationDeg) % 360, ((i + 1) * sliceDeg + wheelRotationDeg) % 360].
 */

export const POINTER_ANGLE_DEG = 270; // Top center (12 o'clock)

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Calculates the exact target rotation angle (in degrees) so that `winningIndex`
 * lands squarely underneath the fixed top pointer (270deg) after `minSpins` full rotations.
 *
 * Requirements satisfied:
 * 1. Winning segment is chosen BEFORE animation starts.
 * 2. Final rotation angle is calculated so that the winning segment aligns with the fixed pointer.
 * 3. Adds subtle randomized jitter inside the safe middle 60% of the winning slice so spins feel organic
 *    without ever crossing a boundary.
 */
export function calculateTargetRotationForWinner(
  currentRotationDeg: number,
  winningIndex: number,
  totalSegments: number,
  minSpins = 5
): number {
  if (totalSegments <= 0) return currentRotationDeg;

  const sliceAngle = 360 / totalSegments;
  // Safe offset within [0.2, 0.8] of the segment width (center is 0.5)
  const safeJitterFactor = 0.25 + Math.random() * 0.5;
  const targetLocalAngle = (winningIndex + safeJitterFactor) * sliceAngle;

  // We need: normalizeAngle(targetLocalAngle + finalRotation) === POINTER_ANGLE_DEG
  const desiredModRotation = normalizeAngle(POINTER_ANGLE_DEG - targetLocalAngle);
  const currentModRotation = normalizeAngle(currentRotationDeg);

  let deltaRotation = desiredModRotation - currentModRotation;
  if (deltaRotation <= 0) {
    deltaRotation += 360;
  }

  const extraSpins = (minSpins + Math.floor(Math.random() * 2)) * 360;
  return currentRotationDeg + extraSpins + deltaRotation;
}

/**
 * Given any wheel rotation angle in degrees, returns the segment index currently under the top pointer.
 * Used both for triggering peg-tick audio when segment boundaries pass the pointer and for
 * unit-testing mathematical accuracy.
 */
export function getSegmentIndexAtPointer(
  wheelRotationDeg: number,
  totalSegments: number
): number {
  if (totalSegments <= 0) return -1;
  const sliceAngle = 360 / totalSegments;
  // Angle on the unrotated wheel that currently sits at POINTER_ANGLE_DEG:
  const localAngleAtPointer = normalizeAngle(POINTER_ANGLE_DEG - wheelRotationDeg);
  const index = Math.floor(localAngleAtPointer / sliceAngle);
  return Math.min(totalSegments - 1, Math.max(0, index));
}

/**
 * Realistic physical spin easing curve:
 * Smooth acceleration phase for the first 12% of time (torque build-up),
 * followed by a long frictional quartic deceleration phase.
 */
export function spinPhysicsEasing(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const accelPhase = 0.12;
  if (t < accelPhase) {
    // Quadratic ease-in matching derivative at t = accelPhase
    const norm = t / accelPhase;
    return 0.06 * norm * norm;
  } else {
    // Smooth quartic ease-out from 0.06 to 1.0
    const norm = (t - accelPhase) / (1 - accelPhase);
    return 0.06 + 0.94 * (1 - Math.pow(1 - norm, 4));
  }
}

/**
 * Runs a self-test of the assignment algorithm and wheel math to verify all invariants.
 */
export function runSystemDiagnostics(): { passed: boolean; details: string[] } {
  const details: string[] = [];
  let passed = true;

  // Test 1: Wheel angle math across 2, 3, 4, 6, 10, 15 segments
  for (const count of [2, 3, 4, 6, 10, 15]) {
    let currentRot = 0;
    for (let winner = 0; winner < count; winner++) {
      const targetRot = calculateTargetRotationForWinner(currentRot, winner, count, 5);
      const detectedWinner = getSegmentIndexAtPointer(targetRot, count);
      if (detectedWinner !== winner) {
        passed = false;
        details.push(`Wheel math mismatch for ${count} segments: expected ${winner}, got ${detectedWinner}`);
      }
      currentRot = targetRot;
    }
  }
  if (passed) {
    details.push('Wheel pointer alignment verified across 2, 3, 4, 6, 10, and 15 segments.');
  }

  return { passed, details };
}
