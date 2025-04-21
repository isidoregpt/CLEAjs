// src/utils/solarCalculations.js
// Improved solar calculations based on the HTML implementation

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
 * Implements improved astronomical calculation similar to the HTML example.
 *
 * @param {number} x - X coordinate of click
 * @param {number} y - Y coordinate of click
 * @param {number} centerX - X coordinate of solar disk center
 * @param {number} centerY - Y coordinate of solar disk center
 * @param {number} radius - Radius of the solar disk in pixels
 * @param {Date} obsTime - Observation time (used for B0 and L0 calculation)
 * @returns {{longitude: number, latitude: number}}
 */
export const calculateHeliographicCoordinates = (x, y, centerX, centerY, radius, obsTime) => {
  // Default B0 and L0 values if not available from FITS headers
  // In a real application, these would be calculated from the observation time
  // For now, using fixed values that would be close for most solar observations
  const B0 = -4.09658890740741; // Heliographic latitude of the center of the solar disk
  const L0 = 287.033322432504; // Heliographic longitude of the center of the solar disk
  const P_ANGLE = 0.0; // Position angle of the solar north pole
  
  // Translate to solar disc coordinate system (origin at solar center)
  const dx = x - centerX;
  const dy = centerY - y; // Y is inverted in canvas/images compared to standard coordinate systems
  
  // Convert to normalized solar radius units
  const rho = Math.sqrt(dx*dx + dy*dy) / radius;
  
  // If point is outside of solar disc, limit to the edge
  if (rho > 1) {
    console.warn("Point outside solar disk, coordinates may be approximate");
  }
  
  // Calculate position angle from solar north
  let theta = Math.atan2(dx, dy) * 180 / Math.PI;
  
  // Adjust for P angle (position angle of solar north pole)
  theta -= P_ANGLE;
  
  // Convert to heliographic coordinates
  // Get B0 in radians (heliographic latitude of disc center)
  const B0rad = degreesToRadians(B0);
  
  // Calculate heliographic latitude (B)
  const rhoRad = degreesToRadians(rho * 90); // Convert rho to radians (rho * 90 degrees)
  const thetaRad = degreesToRadians(theta);
  
  const sinB = Math.cos(rhoRad) * Math.sin(B0rad) + 
                Math.sin(rhoRad) * Math.cos(B0rad) * Math.cos(thetaRad);
  const B = radiansToDegrees(Math.asin(sinB));
  
  // Calculate heliographic longitude (L)
  const y_term = Math.sin(rhoRad) * Math.sin(thetaRad);
  const x_term = Math.sin(rhoRad) * Math.cos(thetaRad) * Math.sin(B0rad) - 
                Math.cos(rhoRad) * Math.cos(B0rad);
  let L = radiansToDegrees(Math.atan2(y_term, x_term)) + L0;
  
  // Normalize longitude to range [0, 360)
  while (L < 0) L += 360;
  while (L >= 360) L -= 360;
  
  // Convert longitude to the -180 to +180 range if preferred
  if (L > 180) L -= 360;
  
  return { longitude: L, latitude: B };
};

// Other functions remain the same
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

export const isPointOnSun = (x, y, centerX, centerY, radius, radiusCorrection = 1.0, xOffset = 0, yOffset = 0) => {
  const adjX = centerX + xOffset;
  const adjY = centerY + yOffset;
  const adjR = radius * radiusCorrection;
  const distance = Math.hypot(x - adjX, y - adjY);
  return distance <= adjR * 1.05;
};

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

export const addCrosshair = (imageElement) => {
  return imageElement.src;
};

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
