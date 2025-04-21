import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { 
  calculateHeliographicCoordinates, 
  determineImageCenterAndRadius,
  readImageFile,
  readFitsFile,
  extractZoomRegion
} from '../utils/solarCalculations';

// Dynamically import components (no SSR)
const KonvaComponents = dynamic(() => import('../components/KonvaComponents'), { ssr: false });
const UploadPanel = dynamic(() => import('../components/UploadPanel'), { ssr: false });
const SidebarControls = dynamic(() => import('../components/SidebarControls'), { ssr: false });
const MeasurementsPanel = dynamic(() => import('../components/MeasurementsPanel'), { ssr: false });
const ImageInfoPanel = dynamic(() => import('../components/ImageInfoPanel'), { ssr: false });
const ZoomViewer = dynamic(() => import('../components/ZoomViewer'), { ssr: false });

export default function Home() {
  // Image and animation state
  const [images, setImages] = useState({});
  const [sortedFilenames, setSortedFilenames] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [animationRunning, setAnimationRunning] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(500);

  // Sun detection & selection state
  const [selectionMode, setSelectionMode] = useState('point');
  const [forceFitsData, setForceFitsData] = useState(true);
  const [detectionMethod, setDetectionMethod] = useState('center');
  const [contourThreshold, setContourThreshold] = useState(15);
  const [radiusCorrection, setRadiusCorrection] = useState(2.0);
  const [centerXOffset, setCenterXOffset] = useState(-21);
  const [centerYOffset, setCenterYOffset] = useState(0);
  const [showSunBoundary, setShowSunBoundary] = useState(true);
  const [disableBoundaryCheck, setDisableBoundaryCheck] = useState(false);

  // Selection & measurement state
  const [currentSelection, setCurrentSelection] = useState(null);
  const [selectionCoords, setSelectionCoords] = useState(null);
  const [heliographicCoords, setHeliographicCoords] = useState(null);
  const [distanceFromCenter, setDistanceFromCenter] = useState(null);
  const [zoomedRegion, setZoomedRegion] = useState(null);
  const [featureLabel, setFeatureLabel] = useState('');
  const [measurements, setMeasurements] = useState([]);

  const animationRef = useRef(null);

  // Compute current image data and display parameters
  const currentFilename = sortedFilenames[currentImageIndex] || null;
  const currentImageData = currentFilename ? images[currentFilename] : null;
  const displayWidth = currentImageData ? Math.min(800, currentImageData.width) : 0;
  const displayHeight = currentImageData
    ? (currentImageData.height / currentImageData.width) * displayWidth
    : 0;
  const scale = currentImageData ? displayWidth / currentImageData.width : 1;

  const adjustedSunParams = currentImageData && currentImageData.sunParams
    ? {
        cx: currentImageData.sunParams.cx * scale + centerXOffset,
        cy: currentImageData.sunParams.cy * scale + centerYOffset,
        radius: currentImageData.sunParams.radius * scale * radiusCorrection
      }
    : { cx: 0, cy: 0, radius: 0 };

  // Animation loop
  useEffect(() => {
    if (animationRunning && sortedFilenames.length) {
      animationRef.current = setInterval(() => {
        setCurrentImageIndex(i => (i + 1) % sortedFilenames.length);
      }, animationSpeed);
    } else {
      clearInterval(animationRef.current);
    }
    return () => clearInterval(animationRef.current);
  }, [animationRunning, animationSpeed, sortedFilenames]);

  // Download measurements as CSV
  const downloadCSV = () => {
    if (!measurements.length) return;
    const header = Object.keys(measurements[0]).join(',');
    const rows = measurements.map(m => [
      m.image,
      m.observationTime,
      m.pixelX.toFixed(2),
      m.pixelY.toFixed(2),
      m.helioLongitude.toFixed(4),
      m.helioLatitude.toFixed(4),
      m.distancePercent.toFixed(2),
      m.label
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'measurements.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // File upload handler
  const handleFileUpload = async files => {
    const newImages = { ...images };
    for (const file of files) {
      if (newImages[file.name]) continue;
      try {
        let data, obsTime, sunParams;
        if (/\.(fits?|FITS)$/i.test(file.name)) {
          ({ image: data, obsTime, sunParams } = await readFitsFile(file));
        } else {
          data = await readImageFile(file);
          obsTime = new Date();
          sunParams = null;
        }
        if (!sunParams) {
          const params = determineImageCenterAndRadius(
            data,
            detectionMethod === 'center',
            contourThreshold
          );
          sunParams = { cx: params.cx, cy: params.cy, radius: params.radius };
        }
        newImages[file.name] = { image: data, obsTime, sunParams, width: data.width, height: data.height };
      } catch (e) {
        console.error('Error uploading file', file.name, e);
      }
    }
    const filenames = Object.keys(newImages).sort();
    setImages(newImages);
    setSortedFilenames(filenames);
    setCurrentImageIndex(0);
  };

  // Handle stage click for measurements
  const handleStageClick = e => {
    if (animationRunning || !currentImageData) return;
    const stage = e.target.getStage();
    const { x, y } = stage.getPointerPosition();
    const sel = selectionMode === 'point'
      ? { x, y, width: 1, height: 1 }
      : { x: x - 10, y: y - 10, width: 20, height: 20 };

    const selX = sel.x + sel.width / 2;
    const selY = sel.y + sel.height / 2;
    const dist = Math.hypot(selX - adjustedSunParams.cx, selY - adjustedSunParams.cy);
    if (!disableBoundaryCheck && dist > adjustedSunParams.radius * 1.05) return;

    const origX = selX / scale;
    const origY = selY / scale;
    const { longitude, latitude } = calculateHeliographicCoordinates(
      origX,
      origY,
      currentImageData.sunParams.cx,
      currentImageData.sunParams.cy,
      currentImageData.sunParams.radius,
      currentImageData.obsTime
    );
    const distPercent = (Math.hypot(
      origX - currentImageData.sunParams.cx,
      origY - currentImageData.sunParams.cy
    ) / currentImageData.sunParams.radius) * 100;

    setCurrentSelection(sel);
    setSelectionCoords({ original: { x: origX, y: origY }, display: { x: selX, y: selY } });
    setHeliographicCoords({ longitude, latitude });
    setDistanceFromCenter({ percent: distPercent });
    setZoomedRegion(
      extractZoomRegion(
        currentImageData.image,
        origX,
        origY,
        60,
        4
      )
    );
  };

  // Record a measurement
  const recordMeasurement = () => {
    if (!selectionCoords || !heliographicCoords) return;
    const m = {
      image: currentFilename,
      observationTime: currentImageData.obsTime.toISOString(),
      pixelX: selectionCoords.original.x,
      pixelY: selectionCoords.original.y,
      helioLongitude: heliographicCoords.longitude,
      helioLatitude: heliographicCoords.latitude,
      distancePercent: distanceFromCenter.percent,
      label: featureLabel
    };
    setMeasurements(prev => [...prev, m]);
    setFeatureLabel('');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Head>
        <title>Solar Rotation Analyzer</title>
      </Head>
      <div className="w-64 bg-white p-4 shadow-md overflow-y-auto">
        <h1 className="text-xl font-bold mb-4">Controls</h1>
        <SidebarControls
          forceFitsData={forceFitsData} setForceFitsData={setForceFitsData}
          detectionMethod={detectionMethod} setDetectionMethod={setDetectionMethod}
          contourThreshold={contourThreshold} setContourThreshold={setContourThreshold}
          radiusCorrection={radiusCorrection} setRadiusCorrection={setRadiusCorrection}
          centerXOffset={centerXOffset} setCenterXOffset={setCenterXOffset}
          centerYOffset={centerYOffset} setCenterYOffset={setCenterYOffset}
          selectionMode={selectionMode} setSelectionMode={setSelectionMode}
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
        <header className="bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold">
            {currentFilename || 'No image loaded'}
          </h2>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-2/3 p-4 overflow-auto">
            {currentImageData ? (
              animationRunning ? (
                <img
                  src={currentImageData.image.src}
                  alt="solar"
                  style={{ maxWidth: '800px', border: '1px solid #ccc' }}
                />
              ) : (
                <div style={{ position: 'relative' }}>
                  <KonvaComponents
                    image={currentImageData.image}
                    width={displayWidth}
                    height={displayHeight}
                    showSunBoundary={showSunBoundary}
                    sunParams={adjustedSunParams}
                    currentSelection={currentSelection}
                    selectionMode={selectionMode}
                    onStageClick={handleStageClick}
                  />
                </div>
              )
            ) : (
              <p className="text-gray-500">Upload images to begin.</p>
            )}
          </div>

          <div className="w-1/3 bg-white shadow-inner p-4 overflow-y-auto">
            <div className="flex mb-4 border-b">
              <button className="px-4 py-2 border-b-2 border-blue-500">
                Measurements
              </button>
              <button className="px-4 py-2">
                Info
              </button>
            </div>

            {currentSelection && (
              <div className="mb-4">
                <p><strong>Orig:</strong> {selectionCoords.original.x.toFixed(2)}, {selectionCoords.original.y.toFixed(2)}</p>
                <p><strong>Helio:</strong> {heliographicCoords.longitude.toFixed(2)}°, {heliographicCoords.latitude.toFixed(2)}°</p>
                <p><strong>Dist%:</strong> {distanceFromCenter.percent.toFixed(1)}%</p>

                <div className="flex items-start mt-2">
                  {zoomedRegion && <ZoomViewer image={zoomedRegion} />}
                  <div className="ml-4">
                    <input
                      type="text"
                      placeholder="Feature Label"
                      value={featureLabel}
                      onChange={e => setFeatureLabel(e.target.value)}
                      className="border p-1 mb-2 w-full"
                    />
                    <button
                      onClick={recordMeasurement}
                      className="bg-blue-500 text-white px-3 py-1 rounded mr-2"
                    >Record</button>
                    <button
                      onClick={downloadCSV}
                      className="bg-green-500 text-white px-3 py-1 rounded"
                    >Download CSV</button>
                  </div>
                </div>
              </div>
            )}

            <MeasurementsPanel measurements={measurements} setMeasurements={setMeasurements} />

            <ImageInfoPanel
              originalDimensions={currentImageData ? { width: currentImageData.width, height: currentImageData.height } : { width:0, height:0 }}
              displayDimensions={currentImageData ? { width: displayWidth, height: displayHeight } : { width:0, height:0 }}
              obsTime={currentImageData?.obsTime}
              sunParams={currentImageData?.sunParams}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
