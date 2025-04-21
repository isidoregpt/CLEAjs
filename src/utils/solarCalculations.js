// src/utils/solarCalculations.js
// This file contains the solar calculation functions compatible with the original implementation

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
 * Calculates heliographic coordinates from image pixel coordinates
 * using the same approach as the original implementation.
 *
 * @param {number} x - X coordinate of click
 * @param {number} y - Y coordinate of click
 * @param {Object} solarData - Object containing solar disc parameters and header information
 * @returns {Object|null} - Object with longitude, latitude, and rho or null if outside the disc
 */
export const calculateHeliographicCoordinates = (x, y, solarData) => {
    // Destructure necessary values from solarData
    const { cx, cy, radius } = solarData.sun_params;
    const { B0, L0, P_ANGLE } = solarData.header;
    
    // Translate to solar disc coordinate system (origin at solar center)
    const dx = x - cx;
    const dy = cy - y; // Y is inverted in canvas
    
    // Convert to normalized solar radius units
    const rho = Math.sqrt(dx*dx + dy*dy) / radius;
    
    // If point is outside of solar disc, return null
    if (rho > 1) return null;
    
    // Calculate position angle from solar north
    let theta = Math.atan2(dx, dy) * 180 / Math.PI;
    
    // Adjust for P angle (position angle of solar north pole)
    theta -= P_ANGLE;
    
    // Convert to heliographic coordinates
    // Get B0 in radians (heliographic latitude of disc center)
    const B0rad = degreesToRadians(B0);
    
    // Calculate heliographic latitude (B)
    const sinB = Math.cos(rho * Math.PI/2) * Math.sin(B0rad) + 
                 Math.sin(rho * Math.PI/2) * Math.cos(B0rad) * Math.cos(degreesToRadians(theta));
    const B = radiansToDegrees(Math.asin(clamp(sinB, -1, 1)));
    
    // Calculate heliographic longitude (L)
    const y_term = Math.sin(rho * Math.PI/2) * Math.sin(degreesToRadians(theta));
    const x_term = Math.sin(rho * Math.PI/2) * Math.cos(degreesToRadians(theta)) * Math.sin(B0rad) - 
                  Math.cos(rho * Math.PI/2) * Math.cos(B0rad);
    let L = radiansToDegrees(Math.atan2(y_term, x_term)) + L0;
    
    // Normalize longitude to range [0, 360)
    while (L < 0) L += 360;
    while (L >= 360) L -= 360;
    
    return { 
        latitude: B, 
        longitude: L, 
        rho: rho 
    };
};

/**
 * Determine the center (cx, cy) and radius of the solar disk in the image.
 * If assumeCentered is true, a simple geometric center estimate is used.
 */
export const determineImageCenterAndRadius = (image, assumeCentered = true, contourThreshold = 0.5) => {
    const width = image.width;
    const height = image.height;
    
    if (assumeCentered) {
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.45;
        return { cx, cy, radius };
    } else {
        // In a real implementation, this would use image processing to detect the solar disk
        // For now, return the same center estimate
        console.log('Image processing would use contour threshold:', contourThreshold);
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.45;
        return { cx, cy, radius };
    }
};

/**
 * Check if a point (x,y) lies within the solar disk
 */
export const isPointOnSun = (x, y, centerX, centerY, radius, radiusCorrection = 1.0) => {
    const adjR = radius * radiusCorrection;
    const distance = Math.sqrt((x - centerX) * (x - centerX) + (y - centerY) * (y - centerY));
    return distance <= adjR;
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
 * Reads a FITS file or image file and sets up the necessary parameters
 */
export const readImageFile = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const sunParams = determineImageCenterAndRadius(img, true);
                resolve({
                    image: img,
                    obsTime: new Date(),
                    sunParams: {
                        cx: sunParams.cx,
                        cy: sunParams.cy,
                        radius: sunParams.radius
                    }
                });
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Draw coordinate grid on canvas
 */
export const drawCoordinateGrid = (ctx, solarData) => {
    const radius = solarData.sun_params.radius;
    const cx = solarData.sun_params.cx;
    const cy = solarData.sun_params.cy;
    const B0 = solarData.header.B0;
    const L0 = solarData.header.L0;
    const P_ANGLE = solarData.header.P_ANGLE;
    
    // Draw latitude circles
    for (let lat = -60; lat <= 60; lat += 30) {
        if (lat === 0) continue; // Skip equator for now
        
        // Calculate radius of this latitude circle
        const rho = Math.cos(lat * Math.PI / 180) / Math.cos(B0 * Math.PI / 180);
        const projRadius = radius * Math.sin(Math.acos(rho * Math.cos(B0 * Math.PI / 180)));
        
        ctx.beginPath();
        ctx.arc(cx, cy, projRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(0, 128, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    
    // Draw equator
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0, 128, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw longitude meridians (every 30 degrees)
    ctx.strokeStyle = 'rgba(0, 128, 255, 0.3)';
    ctx.lineWidth = 1;
    
    for (let long = 0; long < 360; long += 30) {
        const relativeLong = ((long - L0) + 360) % 360;
        // Only draw visible meridians (those on the visible hemisphere)
        if (relativeLong > 90 && relativeLong < 270) continue;
        
        ctx.beginPath();
        
        // Plot points along the meridian
        for (let b = -90; b <= 90; b += 5) {
            const l = long;
            const sinb = Math.sin(b * Math.PI / 180);
            const cosb = Math.cos(b * Math.PI / 180);
            const sinB0 = Math.sin(B0 * Math.PI / 180);
            const cosB0 = Math.cos(B0 * Math.PI / 180);
            const sinl0 = Math.sin((l - L0) * Math.PI / 180);
            const cosl0 = Math.cos((l - L0) * Math.PI / 180);
            
            // Calculate rho (distance from center of disk)
            const cosPsi = sinb * sinB0 + cosb * cosB0 * cosl0;
            if (cosPsi < 0) continue; // Behind the limb
            
            const rho = Math.sqrt(1 - cosPsi * cosPsi);
            
            // Calculate position angle
            const sinTheta = cosb * sinl0 / rho;
            const cosTheta = (sinb * cosB0 - cosb * sinB0 * cosl0) / rho;
            let theta = Math.atan2(sinTheta, cosTheta);
            
            // Adjust for P angle
            theta += P_ANGLE * Math.PI / 180;
            
            // Convert to canvas coordinates
            const x = cx + radius * rho * Math.sin(theta);
            const y = cy - radius * rho * Math.cos(theta);
            
            if (b === -90) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
    }
};
