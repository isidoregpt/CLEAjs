// src/components/UploadPanel.js
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

const UploadPanel = ({ onFileUpload }) => {
  const [uploadStatus, setUploadStatus] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setUploadStatus(`Processing ${acceptedFiles.length} file(s)...`);
      
      // Log file information for debugging
      acceptedFiles.forEach(file => {
        console.log('File:', file.name, 'Type:', file.type, 'Size:', file.size);
      });
      
      onFileUpload(acceptedFiles);
      setUploadStatus(`Uploaded ${acceptedFiles.length} file(s) successfully!`);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      // Image files
      'image/jpeg': [],
      'image/png': [],
      // FITS files
      'image/fits': [],
      'application/fits': [],
      '.fits': [],
      '.fit': [],
      // JSON metadata files
      'application/json': [],
      '.json': []
    },
    multiple: true
  });

  return (
    <div className="mt-6">
      <h2 className="font-bold text-lg mb-2">Load Images</h2>
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-sm text-blue-500">Drop the files here...</p>
        ) : (
          <p className="text-sm text-gray-500">
            Drag & drop image files here, or click to select files
          </p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          Supported formats: JPG, PNG, FITS, FIT, JSON
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Upload PNG+JSON pairs for better sun parameter detection
        </p>
      </div>
      
      {uploadStatus && (
        <div className={`mt-2 p-2 text-sm rounded ${
          uploadStatus.includes('successfully') 
            ? 'bg-green-100 text-green-700' 
            : 'bg-blue-100 text-blue-700'
        }`}>
          {uploadStatus}
        </div>
      )}
    </div>
  );
};

export default UploadPanel;