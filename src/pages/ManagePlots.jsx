import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    MapPin, Home, Ruler, Search, LayoutGrid, List,
    Users, Layers,
} from 'lucide-react';

const STATUS_COLORS = {
    AVAILABLE: '#22c55e',
    BOOKED:    '#f59e0b',
    SOLD:      '#ef4444',
    RESERVED:  '#8b5cf6',
    BLOCKED:   '#6b7280',
    MORTGAGE:  '#3b82f6',
    REGISTRY_PENDING: '#06b6d4',
};
const STATUS_BG = {
    AVAILABLE: 'bg-green-100 text-green-700 border-green-200',
    BOOKED:    'bg-amber-100 text-amber-700 border-amber-200',
    SOLD:      'bg-red-100 text-red-700 border-red-200',
    RESERVED:  'bg-violet-100 text-violet-700 border-violet-200',
    BLOCKED:   'bg-slate-100 text-slate-600 border-slate-200',
    MORTGAGE:  'bg-blue-100 text-blue-700 border-blue-200',
    REGISTRY_PENDING: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};
const STATUS_LABELS = {
    AVAILABLE: 'Available', BOOKED: 'Booked', SOLD: 'Sold', RESERVED: 'Reserved',
    BLOCKED: 'Blocked', MORTGAGE: 'Mortgage', REGISTRY_PENDING: 'Registry Pending',
};

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
            {sub && <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
    </div>
);

const ManagePlots = () => {
    const navigate = useNavigate();
    const [plots, setPlots]   = useState([]);
    const [maps, setMaps]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]   = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [mapFilter, setMapFilter]       = useState('ALL');
    const [viewMode, setViewMode]         = useState('grid');

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        try {
            const { data } = await api.get('/colony-maps');
            if (data.success) {
                setMaps(data.maps);
                const results = await Promise.all(
                    data.maps.map(m => api.get(`/colony-maps/${m.id}`).catch(() => null))
                );
                const allPlots = results.flatMap((res, i) =>
                    (res?.data?.map?.plots || []).map(p => ({ ...p, map_name: data.maps[i].name }))
                );
                setPlots(allPlots);
            }
        } catch {
            toast.error('Failed to load plots');
        } finally {
            setLoading(false);
        }
    };

    const counts = useMemo(() => {
        const c = {};
        for (const p of plots) c[p.status] = (c[p.status] || 0) + 1;
        return c;
    }, [plots]);

    const ownedCount = useMemo(() => plots.filter(p => p.owner_name).length, [plots]);

    const filteredPlots = useMemo(() => {
        const q = search.toLowerCase();
        return plots.filter(p => {
            const matchSearch = !q ||
                p.plot_number?.toLowerCase().includes(q) ||
                p.owner_name?.toLowerCase().includes(q) ||
                p.map_name?.toLowerCase().includes(q) ||
                p.block?.toLowerCase().includes(q);
            const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
            const matchMap    = mapFilter === 'ALL' || String(p.colony_map_id) === mapFilter;
            return matchSearch && matchStatus && matchMap;
        });
    }, [plots, search, statusFilter, mapFilter]);

    return (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-screen-xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" /> All Plots
                </h1>
                <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Overview of every plot across all colony maps.</p>
            </div>

            {/* Stat Cards */}
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                    <StatCard icon={Layers} label="Total Plots" value={plots.length} sub={`${maps.length} colony map(s)`} color="bg-blue-50 text-blue-600" />
                    <StatCard icon={MapPin} label="Available" value={counts.AVAILABLE || 0} sub={`Booked: ${counts.BOOKED || 0} · Sold: ${counts.SOLD || 0}`} color="bg-green-50 text-green-600" />
                    <StatCard icon={Users} label="Owners" value={ownedCount} sub={`Reserved: ${counts.RESERVED || 0} · Blocked: ${counts.BLOCKED || 0}`} color="bg-violet-50 text-violet-600" />
                </div>
            )}

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3 sm:px-5 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="relative flex-1 min-w-0 sm:min-w-48">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Search plot, owner, colony..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 bg-slate-50/50 border-slate-200 rounded-xl h-9 text-sm"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-44 h-9 rounded-xl border-slate-200 bg-slate-50/50 text-sm">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Statuses</SelectItem>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={mapFilter} onValueChange={setMapFilter}>
                    <SelectTrigger className="w-full sm:w-52 h-9 rounded-xl border-slate-200 bg-slate-50/50 text-sm">
                        <SelectValue placeholder="Colony Map" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Colonies</SelectItem>
                        {maps.map(m => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex items-center gap-1 ml-auto">
                    <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="h-9 w-9 rounded-xl" onClick={() => setViewMode('grid')}>
                        <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" className="h-9 w-9 rounded-xl" onClick={() => setViewMode('list')}>
                        <List className="w-4 h-4" />
                    </Button>
                </div>
                <p className="text-xs text-slate-400 whitespace-nowrap">{filteredPlots.length} of {plots.length}</p>
            </div>

            {/* Skeletons */}
            {loading && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
                </div>
            )}

            {/* Empty */}
            {!loading && filteredPlots.length === 0 && (
                <div className="text-center py-16 sm:py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                    <MapPin className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">No plots found.</p>
                    <p className="text-sm text-slate-400 mt-1">Try adjusting your filters.</p>
                </div>
            )}

            {/* Grid View */}
            {!loading && filteredPlots.length > 0 && viewMode === 'grid' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {filteredPlots.map(plot => {
                        const color = STATUS_COLORS[plot.status] || '#6b7280';
                        return (
                            <div
                                key={plot.id}
                                className="group rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden flex flex-col"
                                style={{ backgroundColor: color, border: `2px solid ${color}` }}
                                onClick={() => navigate(`/colony-maps/${plot.colony_map_id}/plots/${plot.id}`)}
                            >
                                <div className="p-3 sm:p-3.5 flex flex-col items-center text-center gap-1.5">
                                    <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight">{plot.plot_number}</h3>
                                    {plot.block && <span className="text-[10px] font-semibold text-white/70">Block {plot.block}</span>}
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest" style={{ backgroundColor: 'rgba(255,255,255,0.22)', color: '#fff' }}>
                                        {STATUS_LABELS[plot.status] || plot.status}
                                    </span>
                                    <div className="w-full mt-1.5 pt-1.5 flex flex-col gap-1 text-[10px]" style={{ borderTop: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.9)' }}>
                                        <div className="flex items-center justify-center gap-1 font-semibold truncate w-full">
                                            <Home className="w-2.5 h-2.5 shrink-0" />
                                            <span className="truncate">{plot.map_name}</span>
                                        </div>
                                        {plot.dimensions && (
                                            <div className="flex items-center justify-center gap-1 opacity-90">
                                                <Ruler className="w-2.5 h-2.5 shrink-0" /> {plot.dimensions}
                                            </div>
                                        )}
                                        {plot.owner_name && (
                                            <div className="font-semibold text-white truncate w-full px-1 mt-0.5">{plot.owner_name}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* List View */}
            {!loading && filteredPlots.length > 0 && viewMode === 'list' && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                    <table className="w-full text-sm min-w-[540px]">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/60">
                                <th className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plot</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Colony</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Dimensions</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">Owner</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredPlots.map(plot => (
                                <tr
                                    key={plot.id}
                                    className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/colony-maps/${plot.colony_map_id}/plots/${plot.id}`)}
                                >
                                    <td className="px-4 sm:px-5 py-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                                                style={{ backgroundColor: STATUS_COLORS[plot.status] || '#6b7280' }}>
                                                {plot.plot_number}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800">Plot {plot.plot_number}</p>
                                                {plot.block && <p className="text-[11px] text-slate-400">Block {plot.block}</p>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-1.5 text-slate-600">
                                            <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="truncate max-w-35">{plot.map_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <Badge variant="outline" className={`text-[11px] font-semibold px-2.5 ${STATUS_BG[plot.status] || 'bg-slate-100 text-slate-600'}`}>
                                            {STATUS_LABELS[plot.status] || plot.status}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3.5 hidden md:table-cell text-slate-600 text-xs">{plot.dimensions || '—'}</td>
                                    <td className="px-4 py-3.5 hidden xl:table-cell text-slate-600 text-xs max-w-37.5 truncate">
                                        {plot.owner_name || <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                            View
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ManagePlots;
