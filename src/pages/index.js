// src/pages/index.js
import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { 
  calculateHeliographicCoordinates, 
  determineImageCenterAndRadius,
  readImageFile,
  readFitsFile,
  extractZoomRegion,
  isPointOnSun
} from '../utils/solarCalculations';

// Dynamically import Konva components with ssr: false
const KonvaComponents = dynamic(
  () => import('../components/KonvaComponents'),
  { ssr: false }
);

// Dynamically import other components that depend on browser APIs
const UploadPanel = dynamic(() => import('../components/UploadPanel'), { ssr: false });
const ZoomViewer = dynamic(() => import('../components/ZoomViewer'), { ssr: false });
const SidebarControls = dynamic(() => import('../components/SidebarControls'), { ssr: false });
const MeasurementsPanel = dynamic(() => import('../components/MeasurementsPanel'), { ssr: false });
const ImageInfoPanel = dynamic(() => import('../components/ImageInfoPanel'), { ssr: false });

export default function Home() {
  // State for images and processing
  const [images, setImages] = useState({});
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [sortedFilenames, setSortedFilenames] = useState([]);
  const [currentSelection, setCurrentSelection] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [animationRunning, setAnimationRunning] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(500);
  const [selectionMode, setSelectionMode] = useState('rect'); // 'rect' or 'point'
  
  // Configuration state
  const [forceFitsData, setForceFitsData] = useState(true);
  const [radiusCorrection, setRadiusCorrection] = useState(2.0);
  const [centerXOffset, setCenterXOffset] = useState(-21);
  const [centerYOffset, setCenterYOffset] = useState(0);
  const [detectionMethod, setDetectionMethod] = useState('center');
  const [contourThreshold, setContourThreshold] = useState(15);
  const [showSunBoundary, setShowSunBoundary] = useState(true);
  const [disableBoundaryCheck, setDisableBoundaryCheck] = useState(false);
  const [zoomSize, setZoomSize] = useState(60);
  const [zoomFactor, setZoomFactor] = useState(4);
  
  // Refs
  const stageRef = useRef(null);
  const animationRef = useRef(null);
  
  // Derived state for current image
  const [currentImage, setCurrentImage] = useState(null);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const [sunParams, setSunParams] = useState({ cx: 0, cy: 0, radius: 0 });
  const [adjustedSunParams, setAdjustedSunParams] = useState({ cx: 0, cy: 0, radius: 0 });
  const [imageScale, setImageScale] = useState(1.0);
  const [obsTime, setObsTime] = useState(null);
  
  // Derived state for selection
  const [selectionCoords, setSelectionCoords] = useState(null);
  const [heliographicCoords, setHeliographicCoords] = useState(null);
  const [distanceFromCenter, setDistanceFromCenter] = useState(null);
  const [zoomedRegion, setZoomedRegion] = useState(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState('measurements');
  const [featureLabel, setFeatureLabel] = useState('');
  
  // Load initial data and set up event listeners
  useEffect(() => {
    // This would typically handle loading initial data
    // For this example, we'll just set up an empty state
    
    // Handle cleanup
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, []);
  
  // Handle changes in sorted filenames
  useEffect(() => {
    if (sortedFilenames.length > 0 && currentImageIndex >= sortedFilenames.length) {
      setCurrentImageIndex(0);
    }
  }, [sortedFilenames, currentImageIndex]);
  
  // Handle animation
  useEffect(() => {
    if (animationRunning && sortedFilenames.length > 0) {
      animationRef.current = setInterval(() => {
        setCurrentImageIndex(prev => (prev + 1) % sortedFilenames.length);
      }, animationSpeed);
    } else if (animationRef.current) {
      clearInterval(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [animationRunning, animationSpeed, sortedFilenames.length]);
  
  // Update current image when index changes
  useEffect(() => {
    if (sortedFilenames.length > 0) {
      const currentFilename = sortedFilenames[currentImageIndex];
      if (images[currentFilename]) {
        setCurrentImage(images[currentFilename].image);
        setObsTime(images[currentFilename].obsTime);
        setOriginalDimensions({
          width: images[currentFilename].width,
          height: images[currentFilename].height
        });
        
        // Calculate display dimensions while maintaining aspect ratio
        const maxWidth = 800;
        let newWidth = images[currentFilename].width;
        let newHeight = images[currentFilename].height;
        let newScale = 1.0;
        
        if (newWidth > maxWidth) {
          newScale = maxWidth / newWidth;
          newWidth = maxWidth;
          newHeight = Math.round(images[currentFilename].height * newScale);
        }
        
        setDisplayDimensions({ width: newWidth, height: newHeight });
        setImageScale(newScale);
        
        // Set sun parameters from stored values or calculate them
        if (images[currentFilename].sunParams) {
          setSunParams(images[currentFilename].sunParams);
        } else {
          // This would calculate based on the image
          const { cx, cy, radius } = determineImageCenterAndRadius(
            images[currentFilename].image,
            detectionMethod === 'center',
            contourThreshold
          );
          setSunParams({ cx, cy, radius });
        }
        
        // Reset selection state
        setCurrentSelection(null);
        setSelectionCoords(null);
        setHeliographicCoords(null);
        setDistanceFromCenter(null);
        setZoomedRegion(null);
      }
    }
  }, [currentImageIndex, sortedFilenames, images, detectionMethod, contourThreshold]);
  
  // Update adjusted sun parameters when offsets change
  useEffect(() => {
    if (sunParams.cx && sunParams.cy && sunParams.radius) {
      const adjustedCx = sunParams.cx * imageScale + centerXOffset;
      const adjustedCy = sunParams.cy * imageScale + centerYOffset;
      const adjustedRadius = sunParams.radius * imageScale * radiusCorrection;
      
      setAdjustedSunParams({
        cx: adjustedCx,
        cy: adjustedCy,
        radius: adjustedRadius
      });
    }
  }, [sunParams, imageScale, centerXOffset, centerYOffset, radiusCorrection]);
  
  // Handle file upload
  const handleFileUpload = async (files) => {
    console.log('handleFileUpload called with files:', files.length);
    
    const newImages = { ...images };
    let newLoaded = false;
    
    // Group files by base name (without extension)
    const fileGroups = {};
    
    // First pass: Group files by base name
    for (const file of files) {
      // Get base name (remove extension)
      const baseName = file.name.split('.').slice(0, -1).join('.');
      if (!fileGroups[baseName]) {
        fileGroups[baseName] = {};
      }
      
      const extension = file.name.split('.').pop().toLowerCase();
      if (extension === 'json') {
        fileGroups[baseName].json = file;
      } else if (['png', 'jpg', 'jpeg'].includes(extension)) {
        fileGroups[baseName].image = file;
      } else if (['fits', 'fit'].includes(extension)) {
        fileGroups[baseName].fits = file;
      }
    }
    
    console.log('File groups:', Object.keys(fileGroups));
    
    // Process each group of files
    for (const [baseName, fileGroup] of Object.entries(fileGroups)) {
      console.log(`Processing group: ${baseName}`);
      
      // Skip if already loaded
      const existingNames = Object.keys(newImages);
      const matchingNames = existingNames.filter(name => name.includes(baseName));
      if (matchingNames.length > 0) {
        console.log(`Image for ${baseName} already loaded, skipping`);
        continue;
      }
      
      try {
        let imageData, obsTimeData, sunParamsData;
        let imageName;
        
        // Case 1: We have a FITS file
        if (fileGroup.fits) {
          console.log(`Processing FITS file: ${fileGroup.fits.name}`);
          const result = await readFitsFile(fileGroup.fits);
          imageData = result.image;
          obsTimeData = result.obsTime;
          sunParamsData = result.sunParams;
          imageName = fileGroup.fits.name;
        }
        // Case 2: We have an image file (PNG/JPG)
        else if (fileGroup.image) {
          console.log(`Processing image file: ${fileGroup.image.name}`);
          imageData = await readImageFile(fileGroup.image);
          obsTimeData = new Date();
          sunParamsData = null;
          imageName = fileGroup.image.name;
          
          // If we also have a JSON metadata file, apply it
          if (fileGroup.json) {
            console.log(`Found metadata file: ${fileGroup.json.name}`);
            try {
              const jsonText = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(fileGroup.json);
              });
              
              const metadata = JSON.parse(jsonText);
              console.log('Parsed metadata:', metadata);
              
              // Extract sun parameters - check both standard and nested formats
              if (metadata.sun_params) {
                console.log('Found sun_params in JSON');
                sunParamsData = metadata.sun_params;
              } else if (metadata.header) {
                // Try to extract from FITS header format
                console.log('Looking for parameters in header section');
                const header = metadata.header;
                if (header.FNDLMBXC && header.FNDLMBYC && header.FNDLMBMI && header.FNDLMBMA) {
                  const cx = parseFloat(header.FNDLMBXC);
                  const cy = parseFloat(header.FNDLMBYC);
                  const minorAxis = parseFloat(header.FNDLMBMI);
                  const majorAxis = parseFloat(header.FNDLMBMA);
                  const radius = (minorAxis + majorAxis) / 2;  // Average the axes only
                  
                  sunParamsData = { cx, cy, radius };
                  console.log('Extracted sun parameters from header:', sunParamsData);
                }
              }
              
              // Extract observation time
              if (metadata.observation_time) {
                obsTimeData = new Date(metadata.observation_time);
                console.log('Loaded observation time from JSON:', obsTimeData);
              } else if (metadata.header && metadata.header['DATE-OBS']) {
                const dateString = metadata.header['DATE-OBS'];
                const timeString = metadata.header['TIME-OBS'] || '00:00:00';
                obsTimeData = new Date(`${dateString}T${timeString}`);
                console.log('Extracted observation time from header:', obsTimeData);
              }
            } catch (error) {
              console.error('Error parsing JSON metadata:', error);
            }
          }
        }
        // No suitable file found
        else {
          console.log(`No suitable image file found for ${baseName}, skipping`);
          continue;
        }
        
        if (!imageData) {
          console.error('No image data returned for', baseName);
          continue;
        }
        
        // Store the image data
        newImages[imageName] = {
          image: imageData,
          obsTime: obsTimeData,
          width: imageData.width,
          height: imageData.height,
          sunParams: sunParamsData
        };
        
        console.log('Added to images collection:', imageName);
        
        // If we don't have sun parameters from FITS or JSON, calculate them
        if (!newImages[imageName].sunParams) {
          console.log('Calculating sun parameters...');
          const { cx, cy, radius } = determineImageCenterAndRadius(
            imageData,
            detectionMethod === 'center',
            contourThreshold
          );
          newImages[imageName].sunParams = { cx, cy, radius };
          console.log('Sun parameters calculated:', cx, cy, radius);
        }
        
        newLoaded = true;
      } catch (error) {
        console.error(`Error processing ${baseName}:`, error);
      }
    }
    
    // Second pass: Process any files that weren't in a group
    for (const file of files) {
      const baseName = file.name.split('.').slice(0, -1).join('.');
      const extension = file.name.split('.').pop().toLowerCase();
      
      // Skip JSON files and files that were already processed in groups
      if (extension === 'json' || (fileGroups[baseName] && 
          (fileGroups[baseName].image || fileGroups[baseName].fits))) {
        continue;
      }
      
      // Skip if this file was already processed
      if (newImages[file.name]) {
        continue;
      }
      
      // Process file individually if it wasn't part of a group
      try {
        const isFits = ['fits', 'fit'].includes(extension);
        let imageData, obsTimeData, sunParamsData;
        
        if (isFits) {
          console.log('Processing individual FITS file...');
          const result = await readFitsFile(file);
          imageData = result.image;
          obsTimeData = result.obsTime;
          sunParamsData = result.sunParams;
        } else if (['png', 'jpg', 'jpeg'].includes(extension)) {
          console.log('Processing individual image file...');
          imageData = await readImageFile(file);
          obsTimeData = new Date();
          sunParamsData = null;
        } else {
          console.log(`Skipping unsupported file type: ${file.name}`);
          continue;
        }
        
        if (!imageData) {
          console.error('No image data returned for', file.name);
          continue;
        }
        
        // Store the image data
        newImages[file.name] = {
          image: imageData,
          obsTime: obsTimeData,
          width: imageData.width,
          height: imageData.height,
          sunParams: isFits && sunParamsData && forceFitsData ? sunParamsData : null
        };
        
        console.log('Added to images collection:', file.name);
        
        // If we don't have sun parameters from FITS, calculate them
        if (!newImages[file.name].sunParams) {
          console.log('Calculating sun parameters...');
          const { cx, cy, radius } = determineImageCenterAndRadius(
            imageData,
            detectionMethod === 'center',
            contourThreshold
          );
          newImages[file.name].sunParams = { cx, cy, radius };
          console.log('Sun parameters calculated:', cx, cy, radius);
        }
        
        newLoaded = true;
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
      }
    }
    
    if (newLoaded) {
      console.log('Setting new images and updating UI...');
      setImages(newImages);
      const newSortedFilenames = Object.keys(newImages).sort();
      console.log('New sorted filenames:', newSortedFilenames);
      setSortedFilenames(newSortedFilenames);
      setCurrentImageIndex(0);
      console.log('UI updated');
    } else {
      console.log('No new images were loaded');
    }
  };
  
  // Handle click on image
  const handleStageClick = (e) => {
    if (animationRunning || !currentImage) return;
    
    const stage = e.target.getStage();
    const { x, y } = stage.getPointerPosition();
    
    if (selectionMode === 'point') {
      // For point selection, just use the coordinates
      handleSelectionMade({ x, y, width: 1, height: 1 });
    } else {
      // For rect selection, let's start drawing a rectangle
      // This would be handled by Konva's transformer or a custom implementation
      // For simplicity, we'll just create a small rectangle around the click point
      const rect = {
        x: x - 10,
        y: y - 10,
        width: 20,
        height: 20
      };
      handleSelectionMade(rect);
    }
  };
  
  // Handle when a selection is made
  const handleSelectionMade = (selection) => {
    // Calculate the center of the selection
    const selX = selection.x + (selection.width / 2);
    const selY = selection.y + (selection.height / 2);
    
    console.log('Selection at', selX, selY);
    console.log('Sun parameters:', adjustedSunParams);
    
    // Check if the point is on the sun
    // Calculate directly to avoid potential issues with the function
    const adjustedCenterX = adjustedSunParams.cx;
    const adjustedCenterY = adjustedSunParams.cy;
    const adjustedRadius = adjustedSunParams.radius;
    const distance = Math.hypot(selX - adjustedCenterX, selY - adjustedCenterY);
    const isOnSun = distance <= (adjustedRadius * 1.05);
    
    console.log('Is on sun?', isOnSun, 'Distance:', distance, 'Radius:', adjustedRadius * 1.05);
    
    if (!disableBoundaryCheck && !isOnSun) {
      // Selection is outside the sun disk
      console.warn("Selected point is outside the solar disk");
      setCurrentSelection(null);
      setSelectionCoords(null);
      setHeliographicCoords(null);
      setDistanceFromCenter(null);
      setZoomedRegion(null);
      return;
    }
    
    // Convert display coordinates to original coordinates
    const origX = selX / imageScale;
    const origY = selY / imageScale;
    
    console.log('Original coordinates:', origX, origY);
    
    // Calculate heliographic coordinates
    const { longitude, latitude } = calculateHeliographicCoordinates(
      origX, origY,
      sunParams.cx, sunParams.cy,
      sunParams.radius,
      obsTime
    );
    
    console.log('Heliographic coordinates:', longitude, latitude);
    
    // Calculate distance from center
    const dist = Math.hypot(origX - sunParams.cx, origY - sunParams.cy);
    const distPercent = (dist / sunParams.radius) * 100;
    
    // Set selection state
    setCurrentSelection(selection);
    setSelectionCoords({ display: { x: selX, y: selY }, original: { x: origX, y: origY } });
    setHeliographicCoords({ longitude, latitude });
    setDistanceFromCenter({ pixels: dist, percent: distPercent });
    
    // Create zoomed region
    createZoomedRegion(origX, origY);
  };
  
  // Create zoomed region from selection
  const createZoomedRegion = (centerX, centerY) => {
    if (!currentImage) return;
    
    console.log('Creating zoomed region at', centerX, centerY);
    
    // Extract and zoom a region of the image
    const zoomed = extractZoomRegion(
      currentImage,
      centerX, centerY,
      zoomSize,
      zoomFactor
    );
    
    setZoomedRegion(zoomed);
  };
  
  // Record a measurement
  const recordMeasurement = () => {
    if (!selectionCoords || !heliographicCoords || !distanceFromCenter) return;
    
    const measurement = {
      image: sortedFilenames[currentImageIndex],
      observationTime: obsTime ? obsTime.toISOString() : 'Unknown',
      pixelX: selectionCoords.original.x,
      pixelY: selectionCoords.original.y,
      helioLongitude: heliographicCoords.longitude,
      helioLatitude: heliographicCoords.latitude,
      distancePercent: distanceFromCenter.percent,
      label: featureLabel
    };
    
    setMeasurements([...measurements, measurement]);
    setFeatureLabel('');
    
    console.log('Measurement recorded:', measurement);
  };
  
  return (
    <div className="flex h-screen bg-gray-100">
      <Head>
        <title>Advanced Solar Rotation Analysis</title>
        <meta name="description" content="Tool for analyzing solar rotation patterns" />
      </Head>
      
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md p-4 overflow-y-auto">
        <h1 className="text-xl font-bold mb-4">Solar Analysis</h1>
        
        <SidebarControls 
          forceFitsData={forceFitsData}
          setForceFitsData={setForceFitsData}
          radiusCorrection={radiusCorrection}
          setRadiusCorrection={setRadiusCorrection}
          centerXOffset={centerXOffset}
          setCenterXOffset={setCenterXOffset}
          centerYOffset={centerYOffset}
          setCenterYOffset={setCenterYOffset}
          selectionMode={selectionMode}
          setSelectionMode={setSelectionMode}
          detectionMethod={detectionMethod}
          setDetectionMethod={setDetectionMethod}
          contourThreshold={contourThreshold}
          setContourThreshold={setContourThreshold}
          showSunBoundary={showSunBoundary}
          setShowSunBoundary={setShowSunBoundary}
          disableBoundaryCheck={disableBoundaryCheck}
          setDisableBoundaryCheck={setDisableBoundaryCheck}
          animationRunning={animationRunning}
          setAnimationRunning={setAnimationRunning}
          animationSpeed={animationSpeed}
          setAnimationSpeed={setAnimationSpeed}
          currentImageIndex={currentImageIndex}
          setCurrentImageIndex={setCurrentImageIndex}
          totalImages={sortedFilenames.length}
        />
        
        <UploadPanel onFileUpload={handleFileUpload} />
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm p-4">
          <h2 className="text-xl font-semibold">
            {sortedFilenames.length > 0
              ? `Current Image: ${sortedFilenames[currentImageIndex]}`
              : 'No image selected'}
          </h2>
        </header>
        
        {/* Main content split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left panel - Image display */}
          <div className="w-2/3 p-4 overflow-auto">
            {currentImage ? (
              animationRunning ? (
                <img 
                  src={currentImage.src} 
                  alt="Solar image" 
                  style={{ 
                    maxWidth: '800px',
                    border: '1px solid #ccc'
                  }} 
                />
              ) : (
                <div style={{ position: 'relative' }}>
                  <KonvaComponents
                    image={currentImage}
                    width={displayDimensions.width}
                    height={displayDimensions.height}
                    showSunBoundary={showSunBoundary}
                    sunParams={adjustedSunParams}
                    currentSelection={currentSelection}
                    selectionMode={selectionMode}
                    onStageClick={handleStageClick}
                  />
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No image loaded. Upload images in the sidebar.</p>
              </div>
            )}
          </div>
          
          {/* Right panel - Data and controls */}
          <div className="w-1/3 bg-white shadow-md p-4 overflow-y-auto">
            <div className="flex mb-4 border-b">
              <button
                className={`px-4 py-2 ${activeTab === 'measurements' ? 'border-b-2 border-blue-500' : ''}`}
                onClick={() => setActiveTab('measurements')}
              >
                Measurements & Data
              </button>
              <button
                className={`px-4 py-2 ${activeTab === 'imageInfo' ? 'border-b-2 border-blue-500' : ''}`}
                onClick={() => setActiveTab('imageInfo')}
              >
                Image Info
              </button>
            </div>
            
            {activeTab === 'measurements' ? (
              <div>
                {!animationRunning && selectionCoords ? (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Selection Data</h3>
                    <p><strong>Display coords:</strong> x = {selectionCoords.display.x.toFixed(2)}, y = {selectionCoords.display.y.toFixed(2)}</p>
                    <p><strong>Original coords:</strong> x = {selectionCoords.original.x.toFixed(2)}, y = {selectionCoords.original.y.toFixed(2)}</p>
                    <p><strong>Heliographic:</strong> Lon = {heliographicCoords.longitude.toFixed(2)}°, Lat = {heliographicCoords.latitude.toFixed(2)}°</p>
                    <p><strong>Distance from center:</strong> {distanceFromCenter.pixels.toFixed(1)} px ({distanceFromCenter.percent.toFixed(1)}% of radius)</p>
                    
                    <hr className="my-4" />
                    
                    {/* Zoom viewer and measurement tools */}
                    <div className="flex">
                      <div className="w-1/2">
                        {zoomedRegion && (
                          <ZoomViewer image={zoomedRegion} />
                        )}
                      </div>
                      <div className="w-1/2 pl-2">
                        <h3 className="text-lg font-semibold">Measurement Data</h3>
                        <p><strong>Observation Time:</strong> {obsTime ? obsTime.toISOString() : 'Unknown'}</p>
                        <p><strong>Heliographic Coordinates:</strong> Lon = {heliographicCoords.longitude.toFixed(2)}°, Lat = {heliographicCoords.latitude.toFixed(2)}°</p>
                        <p><strong>Pixel Coords (Original):</strong> ({selectionCoords.original.x.toFixed(2)}, {selectionCoords.original.y.toFixed(2)})</p>
                        
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700">Feature label:</label>
                          <input
                            type="text"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            value={featureLabel}
                            onChange={(e) => setFeatureLabel(e.target.value)}
                          />
                        </div>
                        
                        <button
                          className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                          onClick={recordMeasurement}
                        >
                          Record Measurement
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">
                    {animationRunning
                      ? "Pause the animation to make measurements."
                      : "Click on the image to measure solar features."}
                  </div>
                )}
                
                <hr className="my-4" />
                
                <MeasurementsPanel
                  measurements={measurements}
                  setMeasurements={setMeasurements}
                />
              </div>
            ) : (
              <ImageInfoPanel
                originalDimensions={originalDimensions}
                displayDimensions={displayDimensions}
                obsTime={obsTime}
                sunParams={sunParams}
                adjustedSunParams={adjustedSunParams}
                imageScale={imageScale}
                centerXOffset={centerXOffset}
                centerYOffset={centerYOffset}
                radiusCorrection={radiusCorrection}
                forceFitsData={forceFitsData}
                currentFilename={sortedFilenames[currentImageIndex] || ''}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}