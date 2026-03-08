import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Image as ImageIcon, Ruler, MapPin, Search, LayoutGrid, Map } from 'lucide-react';
import ColonyLayoutMap from '@/components/ColonyLayoutMap';

const STATUS_COLORS = {
  AVAILABLE: '#22c55e', BOOKED: '#eab308', SOLD: '#ef4444', RESERVED: '#f59e0b',
  BLOCKED: '#6b7280', MORTGAGE: '#8b5cf6', REGISTRY_PENDING: '#3b82f6',
};
const STATUS_TEXT_COLORS = {
  AVAILABLE: '#ffffff', BOOKED: '#ffffff', SOLD: '#ffffff', RESERVED: '#ffffff',
  BLOCKED: '#ffffff', MORTGAGE: '#ffffff', REGISTRY_PENDING: '#ffffff',
};
const STATUS_LABELS = {
  AVAILABLE: 'Available', BOOKED: 'Booked', SOLD: 'Sold', RESERVED: 'Reserved',
  BLOCKED: 'Blocked', MORTGAGE: 'Mortgage', REGISTRY_PENDING: 'Registry Pending',
};

const ColonyMapView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mapData, setMapData] = useState(null);
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({});
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'grid'

  const hasLayoutConfig = (() => {
    if (!mapData?.layout_config) return false;
    try {
      const cfg = typeof mapData.layout_config === 'string'
        ? JSON.parse(mapData.layout_config) : mapData.layout_config;
      return !!(cfg.topLeft || cfg.topRight || cfg.bottomLeft || cfg.bottomRight);
    } catch { return false; }
  })();

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const { data } = await api.get(`/colony-maps/${id}`);
        if (data.success) {
          setMapData(data.map);
          const pList = data.map.plots || [];
          setPlots(pList);
          const s = {};
          pList.forEach(pl => { s[pl.status] = (s[pl.status] || 0) + 1; });
          setStats(s);
        }
      } catch {
        toast.error('Failed to load map');
        navigate('/colony-maps');
      } finally { setLoading(false); }
    };
    fetchMapData();
  }, [id]);

  const filteredPlots = plots.filter(p =>
    p.plot_number.toLowerCase().includes(search.toLowerCase()) ||
    (p.owner_name && p.owner_name.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );

  return (
    <div className="flex flex-col gap-5 sm:gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/colony-maps')} className="rounded-lg cursor-pointer">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <span className="h-5 w-px bg-slate-200 hidden sm:block" />
        <h2 className="text-lg sm:text-2xl font-bold text-slate-800 tracking-tight">{mapData?.name}</h2>

        {/* View toggle: only when layout_config exists */}
        {hasLayoutConfig && (
          <div className="ml-auto flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'map' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <Map className="w-3.5 h-3.5" /> Map
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
          </div>
        )}
      </div>

      {/* Dynamic Interactive Map */}
      {hasLayoutConfig && viewMode === 'map' ? (
        <ColonyLayoutMap
          mapId={id}
          plots={plots}
          layoutConfig={mapData.layout_config}
          userSponsorCode={user?.sponsor_code}
        />
      ) : (
        <>
          {/* Map Image */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-1">
            <div className="bg-slate-50 rounded-xl overflow-hidden relative max-h-100 flex justify-center items-center">
              {mapData?.image_url ? (
                <img src={mapData.image_url} alt="Colony Layout" className="object-contain max-h-100 w-full" />
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                  <p>No layout image</p>
                </div>
              )}
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-xs font-semibold px-3 py-1.5 rounded-full text-slate-700 shadow border border-slate-100">
                {plots.length} Total Plots
              </div>
            </div>
          </div>

          {/* Legend + Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5 text-xs font-medium bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                  <span className="w-3 h-3 rounded-sm shadow-inner" style={{ backgroundColor: color }} />
                  <span className="text-slate-600">{STATUS_LABELS[status]}</span>
                  <span className="ml-1 text-slate-400">({stats[status] || 0})</span>
                </div>
              ))}
            </div>
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search plot or owner..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-slate-50/50 border-slate-200 rounded-xl h-10"
              />
            </div>
          </div>

          {/* Plots Grid */}
          {filteredPlots.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
              <MapPin className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No plots found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredPlots.map(plot => {
                const sc = STATUS_COLORS[plot.status] || '#6b7280';
                const tc = STATUS_TEXT_COLORS[plot.status] || '#ffffff';
                return (
                  <div
                    key={plot.id}
                    onClick={() => navigate(`/colony-maps/${id}/plots/${plot.id}`)}
                    className="group rounded-xl shadow-sm hover:shadow-lg hover:scale-[1.03] transition-all cursor-pointer overflow-hidden flex flex-col"
                    style={{ backgroundColor: sc, border: `2px solid ${sc}` }}
                  >
                    <div className="p-4 flex flex-col items-center text-center gap-2">
                      <h3 className="text-xl font-extrabold" style={{ color: tc }}>{plot.plot_number}</h3>
                      <span
                        className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: tc }}
                      >
                        {STATUS_LABELS[plot.status] || plot.status}
                      </span>
                      <div className="w-full mt-2 pt-2 border-t flex flex-col gap-1 text-xs" style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.9)' }}>
                        {plot.dimensions && (
                          <div className="flex items-center justify-center gap-1.5">
                            <Ruler className="w-3 h-3 opacity-80" /> {plot.dimensions}
                          </div>
                        )}
                        {plot.area_sqft && <div>{plot.area_sqft} sqft</div>}
                        {plot.owner_name && (
                          <div className="mt-1 font-semibold truncate w-full px-2" style={{ color: tc }}>
                            {plot.owner_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ColonyMapView;
