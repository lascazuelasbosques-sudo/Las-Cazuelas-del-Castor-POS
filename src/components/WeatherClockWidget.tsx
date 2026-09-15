import React, { useState, useEffect } from 'react';
import { Calendar, Sparkles, Flag, Heart, Gift, Sun, Flame } from 'lucide-react';

interface Holiday {
  dateKey: string; // MM-DD format
  name: string;
  icon: string;
  badgeBg: string;
  textColor: string;
  description?: string;
}

// Mexican Holidays Dictionary
const MEXICAN_HOLIDAYS: Record<string, Holiday> = {
  '01-01': { dateKey: '01-01', name: '¡Feliz Año Nuevo!', icon: '🎆', badgeBg: 'bg-indigo-50 border-indigo-200', textColor: 'text-indigo-700' },
  '01-06': { dateKey: '01-06', name: 'Día de Reyes', icon: '👑', badgeBg: 'bg-amber-50 border-amber-200', textColor: 'text-amber-700' },
  '02-02': { dateKey: '02-02', name: 'Día de la Candelaria (Tamales)', icon: '🫔', badgeBg: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-800' },
  '02-05': { dateKey: '02-05', name: 'Aniversario de la Constitución', icon: '📜', badgeBg: 'bg-stone-100 border-stone-300', textColor: 'text-stone-800' },
  '02-14': { dateKey: '02-14', name: 'Día de San Valentín', icon: '💖', badgeBg: 'bg-rose-50 border-rose-200', textColor: 'text-rose-700' },
  '02-24': { dateKey: '02-24', name: 'Día de la Bandera de México', icon: '🇲🇽', badgeBg: 'bg-emerald-50 border-emerald-200', textColor: 'text-emerald-800' },
  '03-21': { dateKey: '03-21', name: 'Natalicio de Benito Juárez / Primavera', icon: '🕊️', badgeBg: 'bg-teal-50 border-teal-200', textColor: 'text-teal-800' },
  '04-30': { dateKey: '04-30', name: 'Día del Niño', icon: '🎈', badgeBg: 'bg-purple-50 border-purple-200', textColor: 'text-purple-700' },
  '05-01': { dateKey: '05-01', name: 'Día del Trabajo', icon: '🛠️', badgeBg: 'bg-blue-50 border-blue-200', textColor: 'text-blue-800' },
  '05-05': { dateKey: '05-05', name: 'Batalla de Puebla', icon: '🇲🇽', badgeBg: 'bg-emerald-50 border-emerald-200', textColor: 'text-emerald-800' },
  '05-10': { dateKey: '05-10', name: 'Día de las Madres', icon: '💐', badgeBg: 'bg-pink-50 border-pink-200', textColor: 'text-pink-700' },
  '05-15': { dateKey: '05-15', name: 'Día del Maestro', icon: '🍎', badgeBg: 'bg-amber-50 border-amber-200', textColor: 'text-amber-800' },
  '09-15': { dateKey: '09-15', name: '¡Viva México! Grito de Independencia', icon: '🇲🇽', badgeBg: 'bg-emerald-50 border-emerald-300', textColor: 'text-emerald-800', description: '¡Fiestas Patrias en Las Cazuelas!' },
  '09-16': { dateKey: '09-16', name: 'Día de la Independencia de México', icon: '🇲🇽', badgeBg: 'bg-emerald-50 border-emerald-300', textColor: 'text-emerald-800', description: '¡Orgullo Mexicano!' },
  '10-12': { dateKey: '010-12', name: 'Día de la Raza', icon: '🌎', badgeBg: 'bg-sky-50 border-sky-200', textColor: 'text-sky-800' },
  '10-31': { dateKey: '10-31', name: 'Noche de Brujas', icon: '🎃', badgeBg: 'bg-orange-50 border-orange-200', textColor: 'text-orange-800' },
  '11-01': { dateKey: '11-01', name: 'Día de Todos los Santos', icon: '🕯️', badgeBg: 'bg-amber-50 border-amber-200', textColor: 'text-amber-800' },
  '11-02': { dateKey: '11-02', name: 'Día de Muertos', icon: '💀', badgeBg: 'bg-purple-50 border-purple-300', textColor: 'text-purple-900', description: 'Tradición y Recuerdo' },
  '11-20': { dateKey: '11-20', name: 'Revolución Mexicana', icon: '🏇', badgeBg: 'bg-red-50 border-red-200', textColor: 'text-red-800' },
  '12-12': { dateKey: '12-12', name: 'Día de la Virgen de Guadalupe', icon: '🌹', badgeBg: 'bg-rose-50 border-rose-200', textColor: 'text-rose-800' },
  '12-16': { dateKey: '12-16', name: 'Inicio de las Posadas', icon: '🪅', badgeBg: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-800' },
  '12-24': { dateKey: '12-24', name: '¡Nochebuena!', icon: '🎄', badgeBg: 'bg-emerald-50 border-emerald-200', textColor: 'text-emerald-800' },
  '12-25': { dateKey: '12-25', name: '¡Feliz Navidad!', icon: '🎁', badgeBg: 'bg-red-50 border-red-200', textColor: 'text-red-800' },
  '12-31': { dateKey: '12-31', name: 'Fin de Año', icon: '🎆', badgeBg: 'bg-indigo-50 border-indigo-200', textColor: 'text-indigo-800' }
};

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

  const dayNum = time.getDate();
  const monthName = time.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    month: 'long'
  });

  const yearNum = time.getFullYear();

  // Date Key for Holiday Lookup
  const monthPadded = String(time.getMonth() + 1).padStart(2, '0');
  const dayPadded = String(time.getDate()).padStart(2, '0');
  const currentHolidayKey = `${monthPadded}-${dayPadded}`;
  const currentHoliday = MEXICAN_HOLIDAYS[currentHolidayKey];

  if (compact) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2 py-1 text-stone-900 font-mono select-none shrink-0"
        title="Hora, Fecha y Festividad"
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
        <span className="font-black text-xs text-stone-950 tracking-tight">
          {formattedTimeShort}
        </span>
        <span className="text-stone-300 text-[10px]">//</span>
        <span className="text-[10px] font-bold text-stone-600 capitalize">
          {weekdayName.slice(0, 3)} {dayNum} {monthName.slice(0, 3)} {yearNum}
        </span>
        {currentHoliday && (
          <span className="text-sm shrink-0 ml-0.5" title={currentHoliday.name}>
            {currentHoliday.icon}
          </span>
        )}
      </div>
    );
  }

  // Minimalist Futuristic Display - Larger Date, Month & Year + Holiday Banner
  return (
    <div className="w-full flex flex-col items-center justify-center py-1.5 px-1 select-none font-mono text-center">
      {/* Live Time Display */}
      <div className="flex items-center justify-center gap-1.5 text-stone-900 mb-1">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0 opacity-80" />
        <span className="text-sm lg:text-base font-black tracking-[0.2em] text-stone-950">
          {formattedTimeFull}
        </span>
      </div>

      {/* Larger Futuristic Date Display: Día, Día Num, Mes y Año */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-xs lg:text-sm font-black capitalize tracking-wide text-mex-brown">
          {weekdayName}, {dayNum} de {monthName}
        </div>
        <div className="text-[11px] font-extrabold text-stone-400 tracking-[0.25em]">
          Año {yearNum}
        </div>
      </div>

      {/* Festive Holiday Banner & Illustration (Shows prominently when today is a holiday) */}
      {currentHoliday ? (
        <div className={`mt-2.5 w-full p-2 rounded-xl border ${currentHoliday.badgeBg} flex flex-col items-center gap-1 shadow-sm animate-in fade-in zoom-in-95 duration-300`}>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-xl leading-none animate-bounce">{currentHoliday.icon}</span>
            <span className={`text-[11px] font-black uppercase tracking-wider ${currentHoliday.textColor}`}>
              {currentHoliday.name}
            </span>
            <span className="text-xl leading-none animate-bounce">{currentHoliday.icon}</span>
          </div>
          {currentHoliday.description && (
            <span className="text-[9.5px] font-bold text-stone-600 tracking-tight">
              {currentHoliday.description}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
