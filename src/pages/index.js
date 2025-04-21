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

// Dynamically import components
const KonvaComponents = dynamic(() => import('../components/KonvaComponents'), { ssr: false });
const UploadPanel = dynamic(() => import('../components/UploadPanel'), { ssr: false });
const SidebarControls = dynamic(() => import('../components/SidebarControls'), { ssr: false });
const MeasurementsPanel = dynamic(() => import('../components/MeasurementsPanel'), { ssr: false });
const ImageInfoPanel = dynamic(() => import('../components/ImageInfoPanel'), { ssr: false });
const ZoomViewer = dynamic(() => import('../components/ZoomViewer'), { ssr: false });

export default function Home() {
  // State variables
  const [images, setImages] = useState({});
  const [sortedFilenames, setSortedFilenames] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [animationRunning, setAnimationRunning] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(500);

  const [selectionMode, setSelectionMode] = useState('point');
  const [forceFitsData, setForceFitsData] = useState(true);
  const [detectionMethod, setDetectionMethod] = useState('center');
  const [contourThreshold, setContourThreshold] = useState(15);
  const [radiusCorrection, setRadiusCorrection] = useState(2.0);
  const [centerXOffset, setCenterXOffset] = useState(-21);
  const [centerYOffset, setCenterYOffset] = useState(0);
  const [showSunBoundary, setShowSunBoundary] = useState(true);
  const [disableBoundaryCheck, setDisableBoundaryCheck] = useState(false);

  const [imagesScaleData, setImagesScaleData] = useState({});
  const [sunParamsMap, setSunParamsMap] = useState({});

  const [currentSelection, setCurrentSelection] = useState(null);
  const [selectionCoords, setSelectionCoords] = useState(null);
  const [heliographicCoords, setHeliographicCoords] = useState(null);
  const [distanceFromCenter, setDistanceFromCenter] = useState(null);
  const [zoomedRegion, setZoomedRegion] = useState(null);

  const [featureLabel, setFeatureLabel] = useState('');
  const [measurements, setMeasurements] = useState([]);

  const animationRef = useRef(null);

  // Manage animation loop
  useEffect(() => {
    if (animationRunning && sortedFilenames.length) {
      animationRef.current = setInterval(() => {
        setCurrentImageIndex(idx => (idx + 1) % sortedFilenames.length);
      }, animationSpeed);
    } else if (animationRef.current) {
      clearInterval(animationRef.current);
    }
    return () => animationRef.current && clearInterval(animationRef.current);
  }, [animationRunning, animationSpeed, sortedFilenames]);

  // Build and download CSV
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

  // Handle file uploads
  const handleFileUpload = async files => {
    const newImages = { ...images };
    for (const file of files) {
      const baseName = file.name.split('.').slice(0, -1).join('.');
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
          const { cx, cy, radius } = determineImageCenterAndRadius(data, detectionMethod === 'center', contourThreshold);
          sunParams = { cx, cy, radius };
        }
        newImages[file.name] = { image: data, obsTime, sunParams, width: data.width, height: data.height };
      } catch (e) {
        console.error('Upload error:', e);
      }
    }
    const filenames = Object.keys(newImages).sort();
    setImages(newImages);
    setSortedFilenames(filenames);
    setCurrentImageIndex(0);
  };

  // Handle clicks
  const handleStageClick = e => {
    if (animationRunning) return;
    const stage = e.target.getStage();
    const { x, y } = stage.getPointerPosition();
    const sel = selectionMode === 'point'
      ? { x, y, width: 1, height: 1 }
      : { x: x - 10, y: y - 10, width: 20, height: 20 };
    // compute selection
    const selX = sel.x + sel.width/2;
    const selY = sel.y + sel.height/2;
    const imgData = images[sortedFilenames[currentImageIndex]];
    const scale = (800 / imgData.width) < 1 ? 800 / imgData.width : 1;
    const adj = imgData.sunParams;
    const dist = Math.hypot(selX - adj.cx*scale - centerXOffset, selY - adj.cy*scale - centerYOffset);
    if (!disableBoundaryCheck && dist > (adj.radius*scale*radiusCorrection*1.05)) return;
    const origX = selX/scale;
    const origY = selY/scale;
    const { longitude, latitude } = calculateHeliographicCoordinates(origX, origY, imgData.sunParams.cx, imgData.sunParams.cy, imgData.sunParams.radius, imgData.obsTime);
    const distPerc = (Math.hypot(origX - imgData.sunParams.cx, origY - imgData.sunParams.cy) / imgData.sunParams.radius) * 100;
    setCurrentSelection(sel);
    setSelectionCoords({ original: { x: origX, y: origY }, display: { x: selX, y: selY } });
    setHeliographicCoords({ longitude, latitude });
    setDistanceFromCenter({ percent: distPerc });
    setZoomedRegion(extractZoomRegion(imgData.image, origX, origY, 60, 4));
  };

  // Record measurement
  const recordMeasurement = () => {
    if (!selectionCoords || !heliographicCoords) return;
    const meas = {
      image: sortedFilenames[currentImageIndex],
      observationTime: images[sortedFilenames[currentImageIndex]].obsTime.toISOString(),
      pixelX: selectionCoords.original.x,
      pixelY: selectionCoords.original.y,
      helioLongitude: heliographicCoords.longitude,
      helioLatitude: heliographicCoords.latitude,
      distancePercent: distanceFromCenter.percent,
      label: featureLabel
    };
    setMeasurements([...measurements, meas]);
    setFeatureLabel('');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Head>
        <title>Solar Rotation Analyzer</title>
      </Head>
      {/* Sidebar */}
      <div className="w-64 bg-white p-4 overflow-y-auto shadow">
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

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <header className="bg-white p-4 shadow">
          <h2 className="text-xl">
            {sortedFilenames.length ? sortedFilenames[currentImageIndex] : 'No image loaded'}
          </h2>
        </header>
        <div className="flex flex-1 overflow-hidden">
          {/* Image Section */}
          <div className="w-2/3 p-4 overflow-auto">
            {sortedFilenames.length ? (
              animationRunning ? (
                <img src={images[sortedFilenames[currentImageIndex]].image.src} alt="solar" />
              ) : (
                <div style={{ position: 'relative' }}>
                  <KonvaComponents
                    image={images[sortedFilenames[currentImageIndex]].image}
                    width={Math.min(800, images[sortedFilenames[currentImageIndex]].width)}
                    height={
                      (images[sortedFilenames[currentImageIndex]].height/
                      images[sortedFilenames[currentImageIndex]].width) * Math.min(800, images[sortedFilenames[currentImageIndex]].width)
                    }
                    showSunBoundary={showSunBoundary}
                    sunParams={{
                      cx: images[sortedFilenames[currentImageIndex]].sunParams.cx * (Math.min(800, images[sortedFilenames[currentImageIndex]].width)/images[sortedFilenames[currentImageIndex]].width) + centerXOffset,
                      cy: images[sortedFilenames[currentImageIndex]].sunParams.cy * (Math.min(800, images[sortedFilenames[currentImageIndex]].width)/images[sortedFilenames[currentImageIndex]].width) + centerYOffset,
                      radius: images[sortedFilenames[currentImageIndex]].sunParams.radius * (Math.min(800, images[sortedFilenames[currentImageIndex]].width)/images[sortedFilenames[currentImageIndex]].width) * radiusCorrection
                    }}
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
          {/* Data Panel */}
          <div className="w-1/3 bg-white p-4 overflow-y-auto shadow-inner">
            {/* Tabs */}
            <div className="flex mb-4 border-b">
              <button
                className="px-4 py-2 border-b-2 border-blue-500"
                onClick={() => setCurrentTab('measurements')}
              >Measurements</button>
              <button
                className="px-4 py-2"
                onClick={() => setCurrentTab('info')}
              >Info</button>
            </div>

            {/* Measurements Tab */}
            <div>
              {selectionCoords ? (
                <>  
                  <div className="mb-4">
                    <p><strong>Orig Coords:</strong> {selectionCoords.original.x.toFixed(2)}, {selectionCoords.original.y.toFixed(2)}</p>
                    <p><strong>Helio:</strong> {heliographicCoords.longitude.toFixed(2)}°, {heliographicCoords.latitude.toFixed(2)}°</p>
                    <p><strong>Dist %:</strong> {distanceFromCenter.percent.toFixed(1)}%</p>
                  </div>
                  <div className="flex items-start mb-4">
                    {zoomedRegion && <ZoomViewer image={zoomedRegion} />}
                    <div className="ml-4">
                      <input
                        type="text"
                        placeholder="Label"
                        value={featureLabel}
                        onChange={e => setFeatureLabel(e.target.value)}
                        className="border p-1 mb-2 block w-full"
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
                </>
              ) : (
                <p className="text-gray-500">Click on the image to select a point.</p>
              )}

              <MeasurementsPanel measurements={measurements} setMeasurements={setMeasurements} />
            </div>

            {/* Info Tab */}
            <ImageInfoPanel
              originalDimensions={images[sortedFilenames[currentImageIndex]]?.width ? { width: images[sortedFilenames[currentImageIndex]].width, height: images[sortedFilenames[currentImageIndex]].height } : { width:0, height:0 }}
              displayDimensions={{ width: Math.min(800, images[sortedFilenames[currentImageIndex]]?.width||0), height:0 }}
              obsTime={images[sortedFilenames[currentImageIndex]]?.obsTime}
              sunParams={images[sortedFilenames[currentImageIndex]]?.sunParams}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
