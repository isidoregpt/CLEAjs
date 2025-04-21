// src/components/ImageInfoPanel.js
import React from 'react';

const ImageInfoPanel = ({
  originalDimensions,
  displayDimensions,
  obsTime,
  sunParams,
  adjustedSunParams,
  imageScale,
  centerXOffset,
  centerYOffset,
  radiusCorrection,
  forceFitsData,
  currentFilename
}) => {
  const isFits = currentFilename && (currentFilename.toLowerCase().endsWith('.fits') || currentFilename.toLowerCase().endsWith('.fit'));
  const paramSource = (forceFitsData && isFits) ? "FITS Header" : "Detection";

  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">Image Information</h3>
      
      <div className="space-y-2">
        <p>
          <strong>Original size:</strong> {originalDimensions.width} x {originalDimensions.height}
        </p>
        <p>
          <strong>Display size:</strong> {displayDimensions.width} x {displayDimensions.height}
        </p>
        
        {obsTime && (
          <p>
            <strong>Observation time:</strong> {obsTime.toISOString()}
          </p>
        )}
        
        <p>
          <strong>Sun center:</strong> ({sunParams.cx.toFixed(1)}, {sunParams.cy.toFixed(1)}) px, 
          <strong> Radius:</strong> {sunParams.radius.toFixed(1)} px
        </p>
        
        <p className="text-sm text-gray-600 italic">
          Parameters source: {paramSource}
        </p>
        
        {adjustedSunParams.cx && (
          <>
            <p>
              <strong>Scale:</strong> {imageScale.toFixed(3)}x, 
              <strong> Scaled center:</strong> ({adjustedSunParams.cx.toFixed(1)}, {adjustedSunParams.cy.toFixed(1)}), 
              <strong> Radius:</strong> {adjustedSunParams.radius.toFixed(1)}
            </p>
            
            <p>
              <strong>Circle adjustments:</strong> Size: {radiusCorrection.toFixed(2)}x, 
              X-offset: {centerXOffset}px, Y-offset: {centerYOffset}px
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ImageInfoPanel;