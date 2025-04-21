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

// Dynamically imported components to support SSR-disabled modules
const KonvaComponents = dynamic(() => import('../components/KonvaComponents'), { ssr: false });
const UploadPanel       = dynamic(() => import('../components/UploadPanel'),       { ssr: false });
const ZoomViewer        = dynamic(() => import('../components/ZoomViewer'),        { ssr: false });
const SidebarControls   = dynamic(() => import('../components/SidebarControls'),   { ssr: false });
const MeasurementsPanel = dynamic(() => import('../components/MeasurementsPanel'), { ssr: false });
const ImageInfoPanel    = dynamic(() => import('../components/ImageInfoPanel'),    { ssr: false });

export default function Home() {
  // Images store: { filename: { image, obsTime, width, height, sunParams, header } }
  const [images, setImages] = useState({});
  const [sortedFilenames, setSortedFilenames] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Selection & measurement state
  const [currentSelection, setCurrentSelection] = useState(null);
  const [selectionCoords,  setSelectionCoords]  = useState(null);
  const [heliographicCoords, setHeliographicCoords] = useState(null);
  const [distanceFromCenter, setDistanceFromCenter] = useState(null);
  const [zoomedRegion, setZoomedRegion] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [featureLabel, setFeatureLabel] = useState('');

  // Config and UI state
  const [animationRunning, setAnimationRunning] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(500);
  const [selectionMode, setSelectionMode] = useState('point'); // 'point' or 'rect'

  const [forceFitsData, setForceFitsData]     = useState(true);
  const [radiusCorrection, setRadiusCorrection] = useState(1.0);
  const [centerXOffset, setCenterXOffset]     = useState(0);
  const [centerYOffset, setCenterYOffset]     = useState(0);
  const [detectionMethod, setDetectionMethod] = useState('center');
  const [contourThreshold, setContourThreshold] = useState(15);
  const [showSunBoundary, setShowSunBoundary] = useState(true);
  const [disableBoundaryCheck, setDisableBoundaryCheck] = useState(false);

  // Derived state for display
  const [currentImage, setCurrentImage] = useState(null);
  const [obsTime, setObsTime] = useState(null);
  const [originalDimensions, setOriginalDimensions] = useState({ width:0, height:0 });
  const [displayDimensions, setDisplayDimensions]  = useState({ width:0, height:0 });
  const [imageScale, setImageScale] = useState(1.0);
  const [sunParams, setSunParams] = useState({ cx:0, cy:0, radius:0 });
  const [adjustedSunParams, setAdjustedSunParams] = useState({ cx:0, cy:0, radius:0 });

  // Animation ref
  const animationRef = useRef(null);

  // Advance image when animating
  useEffect(() => {
    if (animationRunning && sortedFilenames.length) {
      animationRef.current = setInterval(() => {
        setCurrentImageIndex(i => (i+1) % sortedFilenames.length);
      }, animationSpeed);
    } else {
      clearInterval(animationRef.current);
    }
    return () => clearInterval(animationRef.current);
  }, [animationRunning, animationSpeed, sortedFilenames]);

  // Reset derived image state when images or index change
  useEffect(() => {
    if (!sortedFilenames.length) return;
    const name = sortedFilenames[currentImageIndex];
    const entry = images[name];
    if (!entry) return;

    const { image, obsTime, width, height, sunParams, header } = entry;
    setCurrentImage(image);
    setObsTime(obsTime);
    setOriginalDimensions({ width, height });

    // scale down to max width 800px
    let scale=1, w=width, h=height;
    if (w > 800) { scale=800/w; w=800; h=Math.round(height*scale); }
    setDisplayDimensions({ width:w, height:h });
    setImageScale(scale);

    // set sun params
    setSunParams(sunParams);

    // clear any selection
    setCurrentSelection(null);
    setSelectionCoords(null);
    setHeliographicCoords(null);
    setDistanceFromCenter(null);
    setZoomedRegion(null);
  }, [currentImageIndex, sortedFilenames, images]);

  // adjust sun params by offsets/correction
  useEffect(() => {
    const { cx, cy, radius } = sunParams;
    const adjCx = cx*imageScale + centerXOffset;
    const adjCy = cy*imageScale + centerYOffset;
    const adjR  = radius*imageScale*radiusCorrection;
    setAdjustedSunParams({ cx:adjCx, cy:adjCy, radius:adjR });
  }, [sunParams, imageScale, centerXOffset, centerYOffset, radiusCorrection]);

  // File upload handler
  const handleFileUpload = async (files) => {
    const newImgs = { ...images };
    let loaded = false;

    // group files by basename
    const groups = {};
    for (const f of files) {
      const base = f.name.replace(/\.[^/.]+$/, '');
      groups[base] = groups[base] || {};
      const ext = f.name.split('.').pop().toLowerCase();
      if (ext === 'json') groups[base].json  = f;
      if (['png','jpg','jpeg'].includes(ext)) groups[base].image = f;
      if (['fits','fit'].includes(ext)) groups[base].fits  = f;
    }

    for (const [base, grp] of Object.entries(groups)) {
      // skip if already loaded
      if (Object.keys(newImgs).some(n=>n.startsWith(base))) continue;

      let imgObj, metadataHeader = {};
      let imageName;
      // FITS case
      if (grp.fits) {
        const r = await readFitsFile(grp.fits);
        imgObj = r.image; metadataHeader = {}; // no header from fits for B0/L0/P_ANGLE
        var entrySunParams = r.sunParams;
        imageName = grp.fits.name;
        var entryObsTime = r.obsTime;
      }
      // image+optional JSON
      else if (grp.image) {
        imgObj = await readImageFile(grp.image);
        entryObsTime = new Date();
        entrySunParams = null;
        imageName = grp.image.name;

        if (grp.json) {
          try {
            const txt = await grp.json.text();
            const md = JSON.parse(txt);
            metadataHeader = md.header || {};
            if (md.sun_params) entrySunParams = md.sun_params;
            // override obsTime if present
            if (md.observation_time) entryObsTime = new Date(md.observation_time);
            // extract FITS header DATE-OBS/TIME-OBS
            if (md.header && md.header['DATE-OBS']) {
              const dt = md.header['DATE-OBS'] + 'T' + (md.header['TIME-OBS']||'00:00:00');
              entryObsTime = new Date(dt);
            }
          } catch(e) {
            console.error('JSON parse err', e);
          }
        }
      }
      else { continue; }

      // calculate sunParams if needed
      if (!entrySunParams) {
        entrySunParams = determineImageCenterAndRadius(imgObj, detectionMethod==='center', contourThreshold);
      }

      newImgs[imageName] = {
        image:    imgObj,
        obsTime:  entryObsTime,
        width:    imgObj.width,
        height:   imgObj.height,
        sunParams: entrySunParams,
        header:    { B0: metadataHeader.B0||0, L0: metadataHeader.L0||0, P_ANGLE: metadataHeader.P_ANGLE||0 }
      };
      loaded = true;
    }

    if (loaded) {
      const names = Object.keys(newImgs).sort();
      setImages(newImgs);
      setSortedFilenames(names);
      setCurrentImageIndex(0);
    }
  };

  // handle clicks
  const handleStageClick = e => {
    if (animationRunning || !currentImage) return;
    const pos = e.target.getStage().getPointerPosition();
    const sel = selectionMode==='point'
      ? { x:pos.x, y:pos.y, width:1, height:1 }
      : { x:pos.x-10, y:pos.y-10, width:20, height:20 };
    onSelectionMade(sel);
  };

  const onSelectionMade = sel => {
    const selX = sel.x + sel.width/2;
    const selY = sel.y + sel.height/2;

    // boundary check
    const dist = Math.hypot(selX - adjustedSunParams.cx, selY - adjustedSunParams.cy);
    if (!disableBoundaryCheck && dist > adjustedSunParams.radius*1.05) {
      setCurrentSelection(null);
      return;
    }

    const origX = selX / imageScale;
    const origY = selY / imageScale;
    const entry = images[sortedFilenames[currentImageIndex]];
    const coords = calculateHeliographicCoordinates(origX, origY, entry.sunParams, entry.header);
    if (!coords) return;

    const d = Math.hypot(origX - entry.sunParams.cx, origY - entry.sunParams.cy);
    const pct = d / entry.sunParams.radius * 100;

    setCurrentSelection(sel);
    setSelectionCoords({ display:{x:selX,y:selY}, original:{x:origX,y:origY} });
    setHeliographicCoords({ longitude:coords.longitude, latitude:coords.latitude });
    setDistanceFromCenter({ pixels:d, percent:pct });
    setZoomedRegion(extractZoomRegion(currentImage, origX, origY, 60, 4));
  };

  const recordMeasurement = () => {
    if (!selectionCoords || !heliographicCoords || !distanceFromCenter) return;
    const name = sortedFilenames[currentImageIndex];
    const m = {
      image: name,
      observationTime: obsTime?.toISOString()||'Unknown',
      pixelX: selectionCoords.original.x,
      pixelY: selectionCoords.original.y,
      helioLongitude: heliographicCoords.longitude,
      helioLatitude: heliographicCoords.latitude,
      distancePercent: distanceFromCenter.percent,
      label: featureLabel
    };
    setMeasurements(ms => [...ms, m]);
    setFeatureLabel('');
  };

  return (
  <div className="flex h-screen bg-gray-100">
    <Head>
      <title>Advanced Solar Rotation Analysis</title>
    </Head>
    <div className="w-64 bg-white p-4 overflow-y-auto">
      <h1 className="text-xl font-bold mb-4">Solar Analysis</h1>
      <SidebarControls
        /* pass all setter props as before */
        forceFitsData={forceFitsData} setForceFitsData={setForceFitsData}
        radiusCorrection={radiusCorrection} setRadiusCorrection={setRadiusCorrection}
        centerXOffset={centerXOffset} setCenterXOffset={setCenterXOffset}
        centerYOffset={centerYOffset} setCenterYOffset={setCenterYOffset}
        selectionMode={selectionMode} setSelectionMode={setSelectionMode}
        detectionMethod={detectionMethod} setDetectionMethod={setDetectionMethod}
        contourThreshold={contourThreshold} setContourThreshold={setContourThreshold}
        showSunBoundary={showSunBoundary} setShowSunBoundary={setShowSunBoundary}
        disableBoundaryCheck={disableBoundaryCheck} setDisableBoundaryCheck={setDisableBoundaryCheck}
        animationRunning={animationRunning} setAnimationRunning={setAnimationRunning}
        animationSpeed={animationSpeed} setAnimationSpeed={setAnimationSpeed}
        currentImageIndex={currentImageIndex} setCurrentImageIndex={setCurrentImageIndex}
        totalImages={sortedFilenames.length}
      />
      <UploadPanel onFileUpload={handleFileUpload} />
    </div>
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="bg-white p-4 shadow">
        <h2 className="text-xl font-semibold">
          {sortedFilenames.length
            ? `Current Image: ${sortedFilenames[currentImageIndex]}`
            : 'No image selected'}
        </h2>
      </header>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-2/3 p-4 overflow-auto">
          {currentImage && !animationRunning
            ? <div style={{position:'relative'}}>
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
            : <div className="text-gray-500 flex items-center justify-center h-full">
                {animationRunning
                  ? 'Playing animation...'
                  : 'Upload images to begin.'}
              </div>
          }
        </div>
        <div className="w-1/3 bg-white p-4 overflow-y-auto">
          {/* Tabs and data panels unchanged */}
          {/* Measurements & ImageInfo panels as in your original code */}
        </div>
      </div>
    </div>
  </div>
  );
}
