// src/utils/solarCalculations.js
// Updated heliographic calculation using Carrington formulas (B0, L0, P‑angle)

// Helper math functions
const degreesToRadians = (degrees) => degrees * Math.PI / 180;
const radiansToDegrees = (radians) => radians * 180 / Math.PI;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Calculates heliographic longitude, latitude, and normalized radius (ρ) for a click
 * on the solar disk, using Carrington formulas with B0, L0, and P‑angle from metadata.
 *
 * @param {number} x         - X pixel coordinate of the click (image coords)
 * @param {number} y         - Y pixel coordinate of the click (image coords)
 * @param {{cx:number, cy:number, radius:number}} sunParams
 *                              - Solar disk center (cx, cy) and radius in pixels
 * @param {{B0:number, L0:number, P_ANGLE:number}} header
 *                              - Metadata header containing B0, L0, and P_ANGLE (degrees)
 * @returns {{latitude:number, longitude:number, rho:number}|null}
 *                              - {latitude:B°, longitude:L°, rho:normalized radius},
 *                                or null if click is outside the solar disk
 */
export function calculateHeliographicCoordinates(x, y, sunParams, header) {
  const { cx, cy, radius } = sunParams;
  // Translate coords so origin is solar center; flip Y for canvas
  const dx = x - cx;
  const dy = cy - y;

  // Normalized radial distance
  const rho = Math.hypot(dx, dy) / radius;
  if (rho > 1) return null; // outside disk

  // Position angle θ from solar north (in degrees)
  let theta = Math.atan2(dx, dy) * 180 / Math.PI;
  // Correct for P‑angle
  theta -= header.P_ANGLE;

  // Convert angles to radians
  const B0 = degreesToRadians(header.B0);
  const L0 = degreesToRadians(header.L0);
  const thetaRad = degreesToRadians(theta);
  const rhoRad = rho * Math.PI/2;

  // Heliographic latitude B:
  // sin B = cos(ρπ/2)·sin B0 + sin(ρπ/2)·cos B0·cos θ
  const sinB = Math.cos(rhoRad) * Math.sin(B0)
             + Math.sin(rhoRad) * Math.cos(B0) * Math.cos(thetaRad);
  const B = radiansToDegrees(Math.asin(clamp(sinB, -1, 1)));

  // Heliographic longitude term:
  const yTerm = Math.sin(rhoRad) * Math.sin(thetaRad);
  const xTerm = Math.sin(rhoRad) * Math.cos(thetaRad) * Math.sin(B0)
              - Math.cos(rhoRad) * Math.cos(B0);
  let L = radiansToDegrees(Math.atan2(yTerm, xTerm)) + header.L0;
  // Normalize L to [0,360)
  L = ((L % 360) + 360) % 360;

  return { latitude: B, longitude: L, rho };
}

/**
 * Other utilities (unchanged)
 */
export const determineImageCenterAndRadius = (image, assumeCentered, contourThreshold) => {
  const width = image.width;
  const height = image.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.45;
  if (!assumeCentered) console.log('Using contourThreshold:', contourThreshold);
  return { cx, cy, radius };
};

export const isPointOnSun = (x, y, centerX, centerY, radius, radiusCorrection=1, xOffset=0, yOffset=0) => {
  const adjX = centerX + xOffset;
  const adjY = centerY + yOffset;
  const adjR = radius * radiusCorrection;
  return Math.hypot(x - adjX, y - adjY) <= adjR * 1.05;
};

export const extractZoomRegion = (image, centerX, centerY, zoomSize=60, zoomFactor=4) => {
  try {
    const canvas = document.createElement('canvas');
    const half = Math.floor(zoomSize/2);
    const left = Math.max(0, Math.floor(centerX-half));
    const top  = Math.max(0, Math.floor(centerY-half));
    const w = Math.min(image.width, left+zoomSize) - left;
    const h = Math.min(image.height, top+zoomSize) - top;
    canvas.width  = w * zoomFactor;
    canvas.height = h * zoomFactor;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, left, top, w, h, 0, 0, canvas.width, canvas.height);
    // crosshair
    const cxC = canvas.width/2, cyC = canvas.height/2;
    ctx.strokeStyle = 'rgba(255,0,255,0.8)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0, cyC); ctx.lineTo(canvas.width, cyC); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cxC,0); ctx.lineTo(cxC,canvas.height); ctx.stroke();
    return canvas.toDataURL();
  } catch(e) {
    console.error(e);
    return image.src;
  }
};

export const readImageFile = async (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = e => { const img = new Image(); img.onload = () => res(img); img.src = e.target.result; };
  r.onerror = rej; r.readAsDataURL(file);
});

export const readFitsFile = async (file) => {
  // ... existing FITS reader stub code ...
  // (unchanged from your previous version)
};
