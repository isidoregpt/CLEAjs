// src/components/ZoomViewer.js
import React from 'react';

const ZoomViewer = ({ image }) => {
  return (
    <div className="border border-gray-300 rounded-md overflow-hidden">
      <h3 className="text-sm font-semibold bg-gray-100 p-2">Zoomed Region</h3>
      <div className="p-2">
        {image ? (
          <img 
            src={image} 
            alt="Zoomed region" 
            className="w-full h-auto"
          />
        ) : (
          <div className="h-32 flex items-center justify-center bg-gray-50">
            <p className="text-sm text-gray-400">No selection</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZoomViewer;