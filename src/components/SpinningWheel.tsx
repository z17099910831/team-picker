import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Sparkles, RotateCcw, Undo2 } from 'lucide-react';
import { Language, WheelOptions, WheelSegment } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import {
  calculateTargetRotationForWinner,
  getSegmentIndexAtPointer,
  spinPhysicsEasing,
} from '../utils/wheelMath';
import { soundManager } from '../utils/sound';

interface SpinningWheelProps {
  segments: WheelSegment[];
  isSpinning: boolean;
  onSpinStart: () => void;
  onSpinComplete: (winner: WheelSegment, index: number) => void;
  options: WheelOptions;
  onUpdateOptions: (partial: Partial<WheelOptions>) => void;
  language: Language;
  lastWinner: WheelSegment | null;
  canUndo: boolean;
  onUndo: () => void;
  hasRemovedTeams: boolean;
  onRestoreRemovedTeams: () => void;
}

export const SpinningWheel: React.FC<SpinningWheelProps> = ({
  segments,
  isSpinning,
  onSpinStart,
  onSpinComplete,
  options,
  onUpdateOptions,
  language,
  lastWinner,
  canUndo,
  onUndo,
  hasRemovedTeams,
  onRestoreRemovedTeams,
}) => {
  const t = TRANSLATIONS[language];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTickIndexRef = useRef<number>(-1);
  const [pointerBounce, setPointerBounce] = useState(false);
  const [currentPointerSegment, setCurrentPointerSegment] = useState<WheelSegment | null>(null);

  const safeSegments: WheelSegment[] =
    segments.length > 0
      ? segments
      : [
          {
            id: 'empty_placeholder',
            label: language === 'zh' ? '请添加名单或团队' : 'Add Items to Spin',
            color: '#94A3B8',
          },
        ];

  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const drawWheel = useCallback(
    (rotationDeg: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const size = 500;
      if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
        canvas.width = size * dpr;
        canvas.height = size * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      const centerX = size / 2;
      const centerY = size / 2;
      const outerRadius = size / 2 - 14;
      const innerRadius = outerRadius - 10;
      const total = safeSegments.length;
      const sliceRad = (2 * Math.PI) / total;
      const rotRad = (rotationDeg * Math.PI) / 180;

      // Outer metallic/structural bezel
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#1E293B';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#CBD5E1';
      ctx.stroke();

      // Draw each segment
      for (let i = 0; i < total; i++) {
        const startAngle = i * sliceRad + rotRad;
        const endAngle = (i + 1) * sliceRad + rotRad;
        const segment = safeSegments[i];

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, innerRadius, startAngle, endAngle);
        ctx.closePath();

        ctx.fillStyle = segment.color;
        ctx.fill();

        // Crisp white divider between slices
        ctx.lineWidth = total > 24 ? 1 : 2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Draw label and optional circular avatar along the radial center of the slice
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceRad / 2);

        const hasPhoto = Boolean(segment.photoUrl && total <= 18);
        const avatarRadius = total > 12 ? 12 : 15;
        const avatarCenterDist = innerRadius - 24;

        if (hasPhoto && segment.photoUrl) {
          const cachedImg = imageCacheRef.current.get(segment.photoUrl);
          if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarCenterDist, 0, avatarRadius, 0, 2 * Math.PI);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(
              cachedImg,
              avatarCenterDist - avatarRadius,
              -avatarRadius,
              avatarRadius * 2,
              avatarRadius * 2
            );
            ctx.restore();

            ctx.beginPath();
            ctx.arc(avatarCenterDist, 0, avatarRadius, 0, 2 * Math.PI);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();
          }
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';

        const fontSize = total > 24 ? 11 : total > 14 ? 13 : total > 8 ? 14 : 16;
        ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

        const maxLabelChars = hasPhoto ? 12 : total > 18 ? 14 : 18;
        const displayLabel =
          segment.label.length > maxLabelChars
            ? segment.label.slice(0, maxLabelChars - 1) + '…'
            : segment.label;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;

        const textRightOffset = hasPhoto
          ? avatarCenterDist - avatarRadius - 8
          : innerRadius - 22;
        ctx.fillText(displayLabel, textRightOffset, 0);
        ctx.restore();
      }

      // Draw perimeter boundary pegs on the outer rim
      for (let i = 0; i < total; i++) {
        const pegAngle = i * sliceRad + rotRad;
        const pegX = centerX + Math.cos(pegAngle) * (outerRadius - 5);
        const pegY = centerY + Math.sin(pegAngle) * (outerRadius - 5);

        ctx.beginPath();
        ctx.arc(pegX, pegY, total > 20 ? 2.5 : 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#0F172A';
        ctx.stroke();
      }

      // Center hub ring shadow
      ctx.beginPath();
      ctx.arc(centerX, centerY, 54, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.fill();

      ctx.restore();

      const idx = getSegmentIndexAtPointer(rotationDeg, total);
      if (idx >= 0 && idx < safeSegments.length) {
        setCurrentPointerSegment(safeSegments[idx]);
      }
    },
    [safeSegments]
  );

  // Preload segment photos into HTMLImageElement cache for canvas rendering
  useEffect(() => {
    safeSegments.forEach((seg) => {
      if (seg.photoUrl && !imageCacheRef.current.has(seg.photoUrl)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!isSpinning) {
            drawWheel(rotationRef.current);
          }
        };
        img.src = seg.photoUrl;
        imageCacheRef.current.set(seg.photoUrl, img);
      }
    });
  }, [safeSegments, isSpinning, drawWheel]);

  // Redraw when segments or language change
  useEffect(() => {
    if (!isSpinning) {
      drawWheel(rotationRef.current);
    }
  }, [drawWheel, isSpinning]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const triggerSpin = useCallback(() => {
    if (isSpinning || segments.length === 0) return;

    onSpinStart();

    // 1. Select the winning segment randomly BEFORE the animation starts
    const winningIndex = Math.floor(Math.random() * segments.length);
    const winningSegment = segments[winningIndex];

    // 2. Calculate exact final rotation angle so winningIndex lands at top pointer (270deg)
    const startRotation = rotationRef.current;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const minSpins = prefersReducedMotion ? 1 : Math.max(4, Math.round(options.spinDuration * 1.3));
    const targetRotation = calculateTargetRotationForWinner(
      startRotation,
      winningIndex,
      segments.length,
      minSpins
    );

    const durationMs = prefersReducedMotion ? 450 : options.spinDuration * 1000;
    const startTime = performance.now();
    lastTickIndexRef.current = getSegmentIndexAtPointer(startRotation, segments.length);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = spinPhysicsEasing(progress);

      const currentAngle = startRotation + (targetRotation - startRotation) * eased;
      rotationRef.current = currentAngle;
      drawWheel(currentAngle);

      // Detect segment boundary pass for realistic peg tick sound & pointer bounce
      const currentIdx = getSegmentIndexAtPointer(currentAngle, segments.length);
      if (currentIdx !== lastTickIndexRef.current) {
        lastTickIndexRef.current = currentIdx;
        if (options.soundEnabled && !prefersReducedMotion) {
          soundManager.playTick();
        }
        setPointerBounce(true);
        setTimeout(() => setPointerBounce(false), 65);
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        rotationRef.current = targetRotation % 360;
        drawWheel(rotationRef.current);
        if (options.soundEnabled) {
          soundManager.playWinChime();
        }
        onSpinComplete(winningSegment, winningIndex);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, [isSpinning, segments, onSpinStart, options.spinDuration, options.soundEnabled, drawWheel, onSpinComplete]);

  // Support global Space/Enter shortcut when focused on body or wheel container
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        triggerSpin();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerSpin]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Wheel Stage Container */}
      <div className="relative flex items-center justify-center w-full max-w-[460px] aspect-square my-2 select-none">
        {/* Fixed Top Pointer (12 o'clock) */}
        <div
          aria-hidden="true"
          className={`absolute -top-3 left-1/2 -translate-x-1/2 z-20 transition-transform duration-75 origin-top ${
            pointerBounce ? '-rotate-12 scale-105' : 'rotate-0 scale-100'
          }`}
        >
          <svg
            width="44"
            height="48"
            viewBox="0 0 44 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-md"
          >
            <path
              d="M22 46L6 14C3.5 9 7.2 3 12.8 3H31.2C36.8 3 40.5 9 38 14L22 46Z"
              fill="#EF4444"
              stroke="#FFFFFF"
              strokeWidth="3"
            />
            <circle cx="22" cy="14" r="5" fill="#FFFFFF" />
          </svg>
        </div>

        {/* Interactive HTML5 Canvas Wheel */}
        <canvas
          ref={canvasRef}
          onClick={triggerSpin}
          role="img"
          aria-label={`Interactive spinning wheel with ${segments.length} segments`}
          className={`w-full h-full rounded-full transition-shadow ${
            isSpinning || segments.length === 0
              ? 'cursor-not-allowed'
              : 'cursor-pointer hover:shadow-xl'
          }`}
        />

        {/* Prominent Center SPIN Button */}
        <button
          type="button"
          onClick={triggerSpin}
          disabled={isSpinning || segments.length === 0}
          aria-label={t.spinButton}
          className="absolute z-20 w-24 h-24 rounded-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-display font-bold text-lg tracking-wider shadow-lg border-4 border-blue-600 hover:bg-blue-600 hover:text-white active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex flex-col items-center justify-center cursor-pointer focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          <span>{isSpinning ? '•••' : t.spinButton}</span>
        </button>
      </div>

      {/* Live Pointer & Spin Status Readout (Screen Reader & Visual) */}
      <div
        aria-live="polite"
        className="w-full max-w-md mt-3 px-4 py-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-4 text-sm"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {currentPointerSegment && (
            <span
              className="w-3.5 h-3.5 rounded-sm shrink-0 border border-black/10"
              style={{ backgroundColor: currentPointerSegment.color }}
            />
          )}
          <span className="text-slate-600 dark:text-slate-300 truncate">
            {isSpinning
              ? t.statusSpinning
              : lastWinner
              ? `${language === 'zh' ? '最新结果' : 'Last Pick'}: `
              : t.statusReady}
            {!isSpinning && lastWinner && (
              <strong className="font-semibold text-slate-900 dark:text-white">
                {lastWinner.label}
              </strong>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={isSpinning}
              title={t.undoLast}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>{t.undoLast}</span>
            </button>
          )}
          {hasRemovedTeams && (
            <button
              type="button"
              onClick={onRestoreRemovedTeams}
              disabled={isSpinning}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.restoreRemovedTeams}</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Wheel Audio, Confetti & Duration Toolbar */}
      <div className="w-full max-w-md mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdateOptions({ soundEnabled: !options.soundEnabled })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              options.soundEnabled
                ? 'bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
            }`}
          >
            {options.soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span>{t.soundEffects}</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateOptions({ confettiEnabled: !options.confettiEnabled })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              options.confettiEnabled
                ? 'bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.confettiEffects}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="spin-duration-slider" className="font-medium whitespace-nowrap">
            {t.spinDurationLabel}:{' '}
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {options.spinDuration}
              {t.seconds}
            </span>
          </label>
          <input
            id="spin-duration-slider"
            type="range"
            min={2}
            max={8}
            step={1}
            value={options.spinDuration}
            onChange={(e) => onUpdateOptions({ spinDuration: Number(e.target.value) })}
            className="w-20 accent-blue-600 cursor-pointer"
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 text-center">
        {t.keyboardShortcutHint}
      </p>
    </div>
  );
};
