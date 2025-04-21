// src/components/SidebarControls.js
import React from 'react';

const SidebarControls = ({
  forceFitsData,
  setForceFitsData,
  radiusCorrection,
  setRadiusCorrection,
  centerXOffset,
  setCenterXOffset,
  centerYOffset,
  setCenterYOffset,
  selectionMode,
  setSelectionMode,
  detectionMethod,
  setDetectionMethod,
  contourThreshold,
  setContourThreshold,
  showSunBoundary,
  setShowSunBoundary,
  disableBoundaryCheck,
  setDisableBoundaryCheck,
  animationRunning,
  setAnimationRunning,
  animationSpeed,
  setAnimationSpeed,
  currentImageIndex,
  setCurrentImageIndex,
  totalImages
}) => {
  return (
    <div className="space-y-4">
      <h2 className="font-bold text-lg">Configuration</h2>
      
      <div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="forceFitsData"
            checked={forceFitsData}
            onChange={(e) => setForceFitsData(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="forceFitsData">Always use FITS header data</label>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Sun Boundary Size Adjustment
        </label>
        <input
          type="range"
          min="1.0"
          max="7.0"  // Increased from 2.5 to 7.0
          step="0.05"
          value={radiusCorrection}
          onChange={(e) => setRadiusCorrection(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="text-xs text-gray-500">
          Value: {radiusCorrection}
        </div>
      </div>
      
      <div>
        <h3 className="font-semibold text-sm">Fine-tune Circle Position</h3>
        
        <div className="mt-2">
          <label className="block text-sm font-medium text-gray-700">
            Horizontal Center Adjustment
          </label>
          <input
            type="range"
            min="-350"  // Increased from -50 to -350
            max="350"   // Increased from 50 to 350
            step="1"
            value={centerXOffset}
            onChange={(e) => setCenterXOffset(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-gray-500">
            Value: {centerXOffset}
          </div>
        </div>
        
        <div className="mt-2">
          <label className="block text-sm font-medium text-gray-700">
            Vertical Center Adjustment
          </label>
          <input
            type="range"
            min="-350"  // Increased from -50 to -350
            max="350"   // Increased from 50 to 350
            step="1"
            value={centerYOffset}
            onChange={(e) => setCenterYOffset(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-gray-500">
            Value: {centerYOffset}
          </div>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Selection Mode
        </label>
        <div className="mt-2">
          <div className="flex space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="selectionMode"
                value="rect"
                checked={selectionMode === 'rect'}
                onChange={() => setSelectionMode('rect')}
                className="mr-1"
              />
              Rectangle
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="selectionMode"
                value="point"
                checked={selectionMode === 'point'}
                onChange={() => setSelectionMode('point')}
                className="mr-1"
              />
              Point
            </label>
          </div>
        </div>
      </div>
      
      {!forceFitsData && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Sun Detection Method
          </label>
          <div className="mt-2">
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="detectionMethod"
                  value="center"
                  checked={detectionMethod === 'center'}
                  onChange={() => setDetectionMethod('center')}
                  className="mr-1"
                />
                Assume Centered
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="detectionMethod"
                  value="detect"
                  checked={detectionMethod === 'detect'}
                  onChange={() => setDetectionMethod('detect')}
                  className="mr-1"
                />
                Contour Detection
              </label>
            </div>
          </div>
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Contour Threshold
        </label>
        <input
          type="range"
          min="1"
          max="50"
          step="1"
          value={contourThreshold}
          onChange={(e) => setContourThreshold(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="text-xs text-gray-500">
          Value: {contourThreshold}
        </div>
      </div>
      
      <div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="showSunBoundary"
            checked={showSunBoundary}
            onChange={(e) => setShowSunBoundary(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="showSunBoundary">Show Sun Boundary Circle</label>
        </div>
      </div>
      
      <div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="disableBoundaryCheck"
            checked={disableBoundaryCheck}
            onChange={(e) => setDisableBoundaryCheck(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="disableBoundaryCheck">Disable Boundary Check</label>
        </div>
      </div>
      
      <h2 className="font-bold text-lg mt-6">Animation Controls</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Animation Speed (ms per frame)
        </label>
        <input
          type="range"
          min="100"
          max="2000"
          step="100"
          value={animationSpeed}
          onChange={(e) => setAnimationSpeed(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="text-xs text-gray-500">
          Value: {animationSpeed}ms
        </div>
      </div>
      
      <div className="flex justify-center mt-2">
        {animationRunning ? (
          <button
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => setAnimationRunning(false)}
          >
            Pause
          </button>
        ) : (
          <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => setAnimationRunning(true)}
          >
            Play
          </button>
        )}
      </div>
      
      <div className="flex space-x-2 mt-2">
        <button
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded"
          onClick={() => {
            setCurrentImageIndex(Math.max(0, currentImageIndex - 1));
            setAnimationRunning(false);
          }}
        >
          Previous
        </button>
        <button
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded"
          onClick={() => {
            setCurrentImageIndex(Math.min(totalImages - 1, currentImageIndex + 1));
            setAnimationRunning(false);
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default SidebarControls;