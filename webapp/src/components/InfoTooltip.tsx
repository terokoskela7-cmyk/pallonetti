import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  content: string;
  label?: string;
}

export function InfoTooltip({
  content,
  label = 'Lisätietoja',
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        className="text-white/30 hover:text-white/70 transition-colors p-0.5 -m-0.5 rounded focus:outline-none focus:ring-1 focus:ring-ice/50"
      >
        <Info className="w-3 h-3" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute z-20 top-full mt-1.5 left-0 w-56 bg-navy-800 border border-navy-600 rounded-md shadow-xl px-3 py-2 text-xs text-white/80 leading-relaxed normal-case tracking-normal font-normal"
        >
          {content}
        </div>
      )}
    </div>
  );
}
