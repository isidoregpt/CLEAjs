// src/components/MeasurementsPanel.js
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

const MeasurementsPanel = ({ measurements, setMeasurements }) => {
  const [filteredMeasurements, setFilteredMeasurements] = useState([]);
  const [selectedLabel, setSelectedLabel] = useState('All');
  const [uniqueLabels, setUniqueLabels] = useState([]);
  const [showPlot, setShowPlot] = useState(false);
  const [plotData, setPlotData] = useState(null);

  useEffect(() => {
    if (measurements.length > 0) {
      // Extract unique labels
      const labels = [...new Set(measurements.map(m => m.label).filter(Boolean))];
      setUniqueLabels(labels);
      
      // Filter by selected label
      if (selectedLabel === 'All') {
        setFilteredMeasurements(measurements);
      } else {
        setFilteredMeasurements(measurements.filter(m => m.label === selectedLabel));
      }
      
      // Check if we should show the plot (single label with at least 2 measurements)
      const singleLabelData = measurements.filter(m => m.label === selectedLabel);
      if (selectedLabel !== 'All' && singleLabelData.length >= 2) {
        prepareRotationAnalysisData(singleLabelData);
        setShowPlot(true);
      } else {
        setShowPlot(false);
      }
    } else {
      setFilteredMeasurements([]);
      setUniqueLabels([]);
      setShowPlot(false);
    }
  }, [measurements, selectedLabel]);

  const prepareRotationAnalysisData = (data) => {
    try {
      // Sort by observation time
      const sortedData = [...data].sort((a, b) => 
        new Date(a.observationTime) - new Date(b.observationTime)
      );
      
      // Calculate hours since first measurement
      const firstTime = new Date(sortedData[0].observationTime);
      const hours = sortedData.map(m => {
        const time = new Date(m.observationTime);
        return (time - firstTime) / (1000 * 60 * 60); // Convert to hours
      });
      
      // Extract longitudes
      const longitudes = sortedData.map(m => m.helioLongitude);
      
      setPlotData({
        hours,
        longitudes,
        label: selectedLabel
      });
    } catch (error) {
      console.error('Error preparing rotation analysis data:', error);
      setShowPlot(false);
    }
  };

  const downloadCSV = () => {
    if (filteredMeasurements.length === 0) return;
    
    // Create CSV header
    const headers = Object.keys(filteredMeasurements[0]);
    const csvRows = [headers.join(',')];
    
    // Add data rows
    for (const row of filteredMeasurements) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    // Create and download the file
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'solar_measurements.csv');
    link.click();
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Recorded Measurements</h3>
      
      {measurements.length > 0 ? (
        <>
          {uniqueLabels.length > 1 && (
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by label:
              </label>
              <select
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={selectedLabel}
                onChange={(e) => setSelectedLabel(e.target.value)}
              >
                <option value="All">All</option>
                {uniqueLabels.map(label => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className="border rounded-md overflow-hidden mb-3">
            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Label</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lon (°)</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lat (°)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMeasurements.map((measurement, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{measurement.image.substring(0, 15)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{measurement.label || '-'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{measurement.helioLongitude.toFixed(2)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{measurement.helioLatitude.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          
          {showPlot && plotData && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Simple Rotation Analysis</h3>
              <div className="border rounded-md p-2">
                <Plot
                  data={[
                    {
                      x: plotData.hours,
                      y: plotData.longitudes,
                      type: 'scatter',
                      mode: 'markers',
                      marker: { color: 'magenta' },
                    },
                  ]}
                  layout={{
                    title: `Longitude changes: ${plotData.label}`,
                    xaxis: { title: 'Hours since first measurement' },
                    yaxis: { title: 'Helio Longitude (°)' },
                    height: 300,
                    margin: { l: 50, r: 30, t: 40, b: 50 },
                  }}
                  config={{ responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">No measurements recorded yet.</p>
      )}
      
      <div className="mt-4">
        <details className="border rounded-md">
          <summary className="p-3 bg-gray-50 cursor-pointer font-medium">About Solar Differential Rotation</summary>
          <div className="p-3">
            <p className="text-sm text-gray-700">
              The Sun doesn't rotate like a solid body—rotation speed depends on latitude:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
              <li>~25 days at the equator</li>
              <li>~36 days near the poles</li>
            </ul>
            <p className="text-sm text-gray-700 mt-1">
              Tracking sunspots over time reveals this differential rotation.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
};

export default MeasurementsPanel;