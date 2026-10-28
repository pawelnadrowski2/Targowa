
import React, { useEffect, useRef, useState } from 'react';
import { TradeOrder } from '../types';
import * as d3 from 'd3';
import { Trophy } from 'lucide-react';

interface LotteryWheelProps {
  candidates: TradeOrder[];
  onWinnerSelected: (winner: TradeOrder) => void;
  logoUrl: string;
}

export const LotteryWheel: React.FC<LotteryWheelProps> = ({ candidates, onWinnerSelected, logoUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [displayCandidates, setDisplayCandidates] = useState<TradeOrder[]>([]);

  // Constants
  const WHEEL_SIZE = 400;
  const RADIUS = WHEEL_SIZE / 2;

  useEffect(() => {
    setDisplayCandidates(candidates);
  }, [candidates]);

  const spinWheel = () => {
    if (spinning || candidates.length === 0) return;
    setSpinning(true);

    // 1. Select Winner Logic (Random)
    const winnerIndex = Math.floor(Math.random() * candidates.length);
    const winner = candidates[winnerIndex];

    // 2. Calculate Geometry
    const sliceAngle = 360 / candidates.length;
    
    const spins = 5 + Math.floor(Math.random() * 3); // Min 5 spins
    const segmentCenterAngle = (winnerIndex * sliceAngle) + (sliceAngle / 2);
    const targetRotation = (spins * 360) - segmentCenterAngle; // Rotate backwards to align segment to 0 (top)

    // Update state to trigger CSS transition
    setRotation(targetRotation);

    // 3. Wait for animation to finish
    setTimeout(() => {
      setSpinning(false);
      onWinnerSelected(winner);
    }, 5000); // Duration must match CSS transition
  };

  // Generate Wheel Segments
  const renderWheelSegments = () => {
    const sliceAngle = 360 / displayCandidates.length;
    // D3 color scale for pretty colors
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

    return displayCandidates.map((candidate, index) => {
      const rotate = index * sliceAngle;
      
      // Convert polar to cartesian
      const startAngle = (index * sliceAngle) * (Math.PI / 180);
      const endAngle = ((index + 1) * sliceAngle) * (Math.PI / 180);
      
      const x1 = RADIUS + RADIUS * Math.cos(startAngle - Math.PI/2); // -PI/2 to start at top
      const y1 = RADIUS + RADIUS * Math.sin(startAngle - Math.PI/2);
      const x2 = RADIUS + RADIUS * Math.cos(endAngle - Math.PI/2);
      const y2 = RADIUS + RADIUS * Math.sin(endAngle - Math.PI/2);

      // SVG Path command
      const largeArcFlag = sliceAngle > 180 ? 1 : 0;
      const pathData = `
        M ${RADIUS} ${RADIUS}
        L ${x1} ${y1}
        A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${x2} ${y2}
        Z
      `;

      return (
        <g key={candidate.id}>
          <path 
            d={pathData} 
            fill={colorScale(index.toString())} 
            stroke="white" 
            strokeWidth="2"
          />
          {/* Text Label */}
          <text
            x={RADIUS + (RADIUS * 0.75) * Math.cos(startAngle + (endAngle - startAngle)/2 - Math.PI/2)}
            y={RADIUS + (RADIUS * 0.75) * Math.sin(startAngle + (endAngle - startAngle)/2 - Math.PI/2)}
            fill="white"
            fontSize={displayCandidates.length > 20 ? "8" : "12"}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${(index * sliceAngle) + (sliceAngle/2)}, ${RADIUS + (RADIUS * 0.75) * Math.cos(startAngle + (endAngle - startAngle)/2 - Math.PI/2)}, ${RADIUS + (RADIUS * 0.75) * Math.sin(startAngle + (endAngle - startAngle)/2 - Math.PI/2)})`}
            style={{ pointerEvents: 'none' }}
          >
            {displayCandidates.length > 30 ? '' : candidate.ticketNumber}
          </text>
        </g>
      );
    });
  };

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Trophy size={48} className="mb-4 opacity-50" />
        <p>Brak losów do losowania.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-8">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-4 z-20 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-slate-800 drop-shadow-lg"></div>
        
        {/* The Wheel */}
        <div 
          className="relative rounded-full shadow-2xl border-8 border-white overflow-hidden"
          style={{ 
            width: WHEEL_SIZE, 
            height: WHEEL_SIZE,
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 5s cubic-bezier(0.15, 0.9, 0.25, 1)' : 'none'
          }}
        >
           <svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}>
             {renderWheelSegments()}
           </svg>
        </div>

        {/* Center Cap */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-white rounded-full shadow-lg flex items-center justify-center z-10 border-4 border-slate-200">
           <img src={logoUrl} alt="Center" className="w-14 object-contain" />
        </div>
      </div>

      <button
        onClick={spinWheel}
        disabled={spinning}
        className={`px-12 py-4 rounded-full text-xl font-black uppercase tracking-widest shadow-xl transition-all transform
          ${spinning 
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed scale-95' 
            : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:scale-105 hover:shadow-rose-500/50 active:scale-95'
          }
        `}
      >
        {spinning ? 'Losowanie...' : 'LOSUJ!'}
      </button>
    </div>
  );
};
