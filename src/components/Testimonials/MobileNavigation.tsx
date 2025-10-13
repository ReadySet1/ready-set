import { motion } from "framer-motion";
import React, { useCallback } from "react";

interface MobileNavigationProps {
  category: "CLIENTS" | "VENDORS" | "DRIVERS";
  currentIndex: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = React.memo(
  ({ category, currentIndex, totalItems, onPrev, onNext }) => {
    // Handlers con useCallback
    const handlePrev = useCallback(
      (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onPrev();
              },
      [onPrev, currentIndex],
    );

    const handleNext = useCallback(
      (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onNext();
              },
      [onNext, currentIndex],
    );

    // No renderizar si solo hay un item
    if (totalItems <= 1) return null;

    return (
      <motion.div
        className="absolute -bottom-8 left-0 z-30 flex w-full justify-center gap-1"
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { delay: 0.5, duration: 0.3 },
        }}
      >
        {/* Botón Anterior */}
        <button
          onClick={handlePrev}
          className="touch-action-manipulation flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 backdrop-blur-sm transition-all hover:bg-white/5 active:scale-95"
          aria-label={`Ir al testimonio anterior de ${category}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Indicador de posición */}
        <div className="flex items-center rounded border border-white/15 bg-black/40 px-2 py-0.5 text-xs font-medium text-white/80 backdrop-blur-sm">
          {currentIndex + 1} / {totalItems}
        </div>

        {/* Botón Siguiente */}
        <button
          onClick={handleNext}
          className="touch-action-manipulation flex h-6 w-6 items-center justify-center rounded-full border border-yellow-400/15 bg-black/40 text-yellow-400/80 backdrop-blur-sm transition-all hover:bg-yellow-400/5 active:scale-95"
          aria-label={`Ir al siguiente testimonio de ${category}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </motion.div>
    );
  },
);

MobileNavigation.displayName = "MobileNavigation";

export default MobileNavigation;
