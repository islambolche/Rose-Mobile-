import React, { useEffect, useState } from 'react';
import { Cloud, Loader2, MapPin } from 'lucide-react';

export const WeatherCard = () => {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const res = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`);
        if (res.ok) {
            const data = await res.json();
            setWeather(data);
        }
      } catch (e) {
        console.error('Weather fetch error', e);
      } finally {
        setLoading(false);
      }
    }, () => setLoading(false));
  }, []);

  if (loading) return <div className="bg-[#0A1628]/90 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-400" /></div>;
  if (!weather) return null;

  return (
    <div className="bg-[#0A1628]/90 border border-emerald-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Cloud className="w-8 h-8 text-emerald-400" />
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider">{weather.name}</h3>
          <p className="text-[10px] text-slate-400 uppercase font-bold">{weather.weather[0].description}</p>
        </div>
      </div>
      <span className="text-2xl font-black text-white">{Math.round(weather.main.temp)}°C</span>
    </div>
  );
};
