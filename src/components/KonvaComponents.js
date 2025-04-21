// src/components/KonvaComponents.js
import React, { useRef } from 'react';
import { Stage, Layer, Image, Rect, Circle } from 'react-konva';

const KonvaComponents = ({
  image,
  width,
  height,
  showSunBoundary,
  sunParams,
  currentSelection,
  selectionMode,
  onStageClick
}) => {
  const imageRef = useRef(null);
  
  return (
    <Stage
      width={width}
      height={height}
      onClick={onStageClick}
    >
      <Layer>
        <Image
          ref={imageRef}
          image={image}
          width={width}
          height={height}
        />
        
        {/* Draw sun boundary if enabled */}
        {showSunBoundary && sunParams && (
          <Circle
            x={sunParams.cx}
            y={sunParams.cy}
            radius={sunParams.radius}
            stroke="red"
            strokeWidth={2}
            listening={false}
          />
        )}
        
        {/* Draw current selection if any */}
        {currentSelection && (
          selectionMode === 'rect' ? (
            <Rect
              x={currentSelection.x}
              y={currentSelection.y}
              width={currentSelection.width}
              height={currentSelection.height}
              stroke="#FF00FF"
              strokeWidth={2}
              fill="rgba(255,0,255,0.3)"
              listening={false}
            />
          ) : (
            <Circle
              x={currentSelection.x}
              y={currentSelection.y}
              radius={5}
              fill="#FF00FF"
              listening={false}
            />
          )
        )}
      </Layer>
    </Stage>
  );
};

export default KonvaComponents;