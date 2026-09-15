import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export function WeatherClockWidget({ compact = false }: { compact?: boolean }) {
  const [time, setTime] = useState<Date>(new Date());

  // Clock Ticker (updates every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Time formatters (CDMX timezone)
  const formattedTimeFull = time.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const formattedTimeShort = time.toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const weekdayName = time.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'long'
  });

  const fullDateStr = time.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  if (compact) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2 py-1 bg-stone-900 text-stone-100 rounded-lg border border-stone-800 shadow-xs shrink-0 select-none"
        title="Hora y Fecha Actual"
      >
        <Clock size={12} className="text-amber-400 shrink-0 animate-pulse" />
        <span className="font-mono font-black text-[11px] text-amber-300 tracking-tight">
          {formattedTimeShort}
        </span>
        <span className="text-stone-600 text-[10px]">|</span>
        <span className="text-[9.5px] font-bold text-stone-300 capitalize">
          {weekdayName.slice(0, 3)}. {time.getDate()}
        </span>
      </div>
    );
  }

  // Highlighted Clock & Date Display (Full Mode - Placed below logo)
  return (
    <div className="w-full bg-stone-900 border border-stone-800 p-2 lg:p-2.5 rounded-2xl shadow-md text-white flex flex-col items-center justify-center gap-1 transition-all select-none">
      {/* Live Time Display */}
      <div className="flex items-center gap-1.5 bg-stone-950/80 px-2.5 py-1 rounded-xl border border-stone-800 w-full justify-center">
        <Clock size={13} className="text-amber-400 shrink-0" />
        <span className="font-mono text-xs lg:text-sm font-black text-amber-400 tracking-widest leading-none drop-shadow-sm">
          {formattedTimeFull}
        </span>
      </div>

      {/* Live Date Display */}
      <div className="flex items-center gap-1 text-stone-300 font-extrabold text-[10px] lg:text-[11px] uppercase tracking-wide text-center pt-0.5">
        <Calendar size={11} className="text-mex-gold shrink-0" />
        <span className="capitalize text-stone-200">{weekdayName}</span>
        <span className="text-stone-500">•</span>
        <span className="text-stone-300">{fullDateStr}</span>
      </div>
    </div>
  );
}
