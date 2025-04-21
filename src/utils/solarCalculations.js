// src/utils/solarCalculations.js
// This file contains the solar calculation functions ported from Python and improved for accuracy

// Helper math functions
const degreesToRadians = (degrees) => {
  return degrees * Math.PI / 180;
};

const radiansToDegrees = (radians) => {
  return radians * 180 / Math.PI;
};

const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Calculates heliographic longitude and latitude from pixel coordinates.
 * Implements improved handling near center and limb, with perspective correction.
 *
 * @param {number} x - X coordinate of click
 * @param {number} y - Y coordinate of click
 * @param {number} centerX - X coordinate of solar disk center
 * @param {number} centerY - Y coordinate of solar disk center
 * @param {number} radius - Radius of the solar disk in pixels
 * @param {Date} obsTime - Observation time (unused in this simple model)
 * @returns {{longitude: number, latitude: number}}
 */
export const calculateHeliographicCoordinates = (x, y, centerX, centerY, radius, obsTime) => {
  // Normalize coordinates relative to the center and radius
  let xNorm = (x - centerX) / radius;
  let yNorm = (y - centerY) / radius;

  // Distance from center (0 to 1)
  let dist = Math.sqrt(xNorm * xNorm + yNorm * yNorm);

  // Very close to center -> zero coordinates
  if (dist < 0.001) {
    return { longitude: 0.0, latitude: 0.0 };
  }

  // If beyond limb, project onto limb circle
  if (dist > 1.0) {
    const adjustFactor = 1.0 / dist;
    xNorm *= adjustFactor;
    yNorm *= adjustFactor;
    dist = 1.0;
  }

  // Calculate position angle from vertical axis
  // atan2(center-to-click X, negative center-to-click Y)
  let angleDeg = Math.atan2(xNorm, -yNorm) * 180 / Math.PI;

  // Compute heliographic longitude: simple arcsin projection
  let longitude = Math.asin(clamp(xNorm / Math.max(1.0, dist), -1.0, 1.0)) * 180 / Math.PI;

  // Compute heliographic latitude: corrected by cosine of longitude
  const lonRad = degreesToRadians(longitude);
  let latitude = Math.asin(
    clamp(-yNorm / (Math.cos(lonRad) * Math.max(1.0, dist)), -1.0, 1.0)
  ) * 180 / Math.PI;

  // Perspective foreshortening correction near limb
  if (dist > 0.8) {
    const limbFactor = 1.0 - dist * dist;
    const corr = 1.0 + (1.0 - limbFactor) * 0.25;
    longitude *= corr;
    latitude *= corr;
  }

  return { longitude, latitude };
};

/**
 * Determine the center (cx, cy) and radius of the solar disk in the image.
 * If assumeCentered is true, a simple geometric center estimate is used.
 * Contour detection to be added if assumeCentered=false.
 */
export const determineImageCenterAndRadius = (image, assumeCentered, contourThreshold) => {
  const width = image.width;
  const height = image.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.45;

  if (!assumeCentered) {
    console.log('Image processing would use contour threshold:', contourThreshold);
  }

  return { cx, cy, radius };
};

/**
 * Check if a point (x,y) lies within the solar disk, with optional corrections.
 */
export const isPointOnSun = (x, y, centerX, centerY, radius, radiusCorrection = 1.0, xOffset = 0, yOffset = 0) => {
  const adjX = centerX + xOffset;
  const adjY = centerY + yOffset;
  const adjR = radius * radiusCorrection;
  const distance = Math.hypot(x - adjX, y - adjY);
  return distance <= adjR * 1.05;
};

/**
 * Extracts a zoomed-in region around (centerX, centerY) from the image.
 * Returns a data URL of the zoomed canvas.
 */
export const extractZoomRegion = (image, centerX, centerY, zoomSize = 60, zoomFactor = 4) => {
  try {
    const canvas = document.createElement('canvas');
    const half = Math.floor(zoomSize / 2);
    const left = Math.max(0, Math.floor(centerX - half));
    const top = Math.max(0, Math.floor(centerY - half));
    const right = Math.min(image.width, Math.floor(centerX + half));
    const bottom = Math.min(image.height, Math.floor(centerY + half));

    const w = right - left;
    const h = bottom - top;
    canvas.width = w * zoomFactor;
    canvas.height = h * zoomFactor;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, left, top, w, h, 0, 0, canvas.width, canvas.height);

    // Draw crosshair
    const cxCanvas = canvas.width / 2;
    const cyCanvas = canvas.height / 2;
    ctx.strokeStyle = 'rgba(255,0,255,0.8)';
    ctx.lineWidth = 2;
    // horizontal
    ctx.beginPath(); ctx.moveTo(0, cyCanvas); ctx.lineTo(canvas.width, cyCanvas); ctx.stroke();
    // vertical
    ctx.beginPath(); ctx.moveTo(cxCanvas, 0); ctx.lineTo(cxCanvas, canvas.height); ctx.stroke();

    return canvas.toDataURL();
  } catch (err) {
    console.error('Error creating zoomed region:', err);
    return image.src;
  }
};

/**
 * Placeholder for adding a crosshair overlay to an HTMLImageElement.
 */
export const addCrosshair = (imageElement) => {
  return imageElement.src;
};

/**
 * Reads a FITS file as an image for preview; falls back to placeholder if unsupported.
 */
export const readFitsFile = async (file) => {
  console.log('Reading FITS file:', file.name);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const image = new Image();
      image.onload = () => res(image);
      image.onerror = rej;
      image.src = url;
    });
    const sunParams = { cx: img.width/2, cy: img.height/2, radius: Math.min(img.width, img.height)*0.45 };
    return { image: img, obsTime: new Date(), sunParams };
  } catch {
    // placeholder canvas
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0,0,800,800);
    ctx.fillStyle = '#666'; ctx.font = '20px Arial'; ctx.textAlign = 'center';
    ctx.fillText(`FITS: ${file.name}`, 400, 380);
    ctx.fillText('(no preview)', 400, 420);
    const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = canvas.toDataURL(); });
    const sunParams = { cx:400, cy:400, radius:350 };
    return { image: img, obsTime: new Date(), sunParams };
  }
};

/**
 * Reads a generic image file and returns an HTMLImageElement.
 */
export const readImageFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
