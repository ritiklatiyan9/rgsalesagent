import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Map } from 'lucide-react';

const ColonyMaps = () => {
  const navigate = useNavigate();
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMaps = async () => {
      try {
        const { data } = await api.get('/colony-maps');
        if (data.success) setMaps(data.maps);
      } catch { toast.error('Failed to load colony maps'); }
      finally { setLoading(false); }
    };
    fetchMaps();
  }, []);

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-64 rounded-2xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Map className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500 shrink-0" /> Colony Maps
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">View interactive colony layout maps and plot availability</p>
      </div>

      {maps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
            <Map className="w-10 h-10 text-slate-300" />
          </div>
          <p className="text-lg font-semibold text-slate-600">No colony maps available</p>
          <p className="text-sm text-slate-400 mt-1">Maps will appear here once they are created by admin</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {maps.map(map => (
            <div
              key={map.id}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg transition-shadow group cursor-pointer"
              onClick={() => navigate(`/colony-maps/${map.id}`)}
            >
              <div className="relative h-48 bg-slate-50 overflow-hidden">
                <img
                  src={map.image_url} alt={map.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-xs font-semibold px-3 py-1 rounded-full text-emerald-700 shadow">
                  {map.plot_count || 0} Plots
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-[16px] text-slate-800 truncate">{map.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Created {new Date(map.created_at).toLocaleDateString()}
                </p>
                <div className="mt-4">
                  <div className="w-full text-center py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 group-hover:bg-emerald-100 transition-colors">
                    <Map className="w-3.5 h-3.5 inline mr-1.5" /> View Map & Plots
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ColonyMaps;
