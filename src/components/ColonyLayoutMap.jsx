import { useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

// ─── Status config ────────────────────────────────────────
const STATUS_MAP = {
  AVAILABLE:        { color: '#22c55e', label: 'Available' },
  BOOKED:           { color: '#ef4444', label: 'Booked' },
  SOLD:             { color: '#991b1b', label: 'Sold' },
  RESERVED:         { color: '#eab308', label: 'Reserved' },
  BLOCKED:          { color: '#f97316', label: 'Hold' },
  MORTGAGE:         { color: '#8b5cf6', label: 'Mortgage' },
  REGISTRY_PENDING: { color: '#3b82f6', label: 'Registry Pending' },
};

// ─── helpers ──────────────────────────────────────────────
const parseGridKey = (polygonPoints) => {
  try {
    const pts = typeof polygonPoints === 'string' ? JSON.parse(polygonPoints) : polygonPoints;
    if (Array.isArray(pts) && pts[0]?.quadrant !== undefined) {
      const p = pts[0];
      return `${p.quadrant}-${p.row}-${p.col}`;
    }
  } catch { /* noop */ }
  return null;
};

// ─── Status Legend ────────────────────────────────────────
const StatusLegend = memo(({ stats, total }) => (
  <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
    {Object.entries(STATUS_MAP).map(([key, { color, label }]) => (
      <div key={key} className="flex items-center gap-1.5 text-xs font-medium bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-400">({stats[key] || 0})</span>
      </div>
    ))}
    <span className="ml-auto text-xs text-slate-400 font-medium">Total: {total}</span>
  </div>
));
StatusLegend.displayName = 'StatusLegend';

// ─── Plot Box ────────────────────────────────────────────
const PlotBox = memo(({ plot, gridKey, onClick }) => {
  const status = plot?.status || 'AVAILABLE';
  const bg = STATUS_MAP[status]?.color || '#22c55e';
  const display = plot?.plot_number || gridKey;

  return (
    <div
      className="flex-1 h-9 min-w-9 rounded-[3px] border border-white/15 cursor-pointer
        hover:brightness-125 hover:scale-110 hover:z-20 hover:shadow-lg
        transition-all duration-200 flex items-center justify-center
        text-[8px] font-bold text-white/90 select-none relative group"
      style={{ backgroundColor: bg }}
      onClick={() => onClick(plot, gridKey)}
    >
      {display && <span className="truncate px-0.5 drop-shadow-sm">{display}</span>}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-[9px]
            px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100
            transition-opacity pointer-events-none z-50 shadow-lg">
        {display || gridKey} &middot; {STATUS_MAP[status]?.label}
      </div>
    </div>
  );
});
PlotBox.displayName = 'PlotBox';

// ─── Road Strip ──────────────────────────────────────────
const RoadStrip = memo(({ isMain }) => (
  <div className={`flex items-center justify-center relative overflow-hidden
    ${isMain ? 'py-3 bg-linear-to-r from-slate-800 via-slate-700 to-slate-800' : 'py-1.5 bg-linear-to-r from-slate-800/80 via-slate-700/80 to-slate-800/80'}`}>
    <div className="absolute inset-0 flex items-center">
      <div className={`w-full ${isMain ? 'border-t-2' : 'border-t'} border-dashed border-yellow-400/25`} />
    </div>
    {isMain && (
      <>
        <div className="absolute top-1 left-0 right-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
        <div className="absolute bottom-1 left-0 right-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
      </>
    )}
    {!isMain && (
      <span className="relative z-10 font-bold tracking-[0.2em] uppercase rounded-full text-[7px] text-white/30 bg-slate-800/60 px-3 py-0.5">
        ROAD
      </span>
    )}
  </div>
));
RoadStrip.displayName = 'RoadStrip';

// ─── Tree Border ─────────────────────────────────────────
const TREES = ['🌳','🌲','🌴','🌳','🌲','🌳','🌴','🌲','🌳','🌲'];
const TreeBorder = memo(() => (
  <div className="pointer-events-none select-none" aria-hidden>
    <div className="flex items-center justify-between px-4">
      {TREES.map((t, i) => <span key={i} className="text-xs sm:text-sm opacity-90">{t}</span>)}
    </div>
  </div>
));
TreeBorder.displayName = 'TreeBorder';

// ═════════════════════════════════════════════════════════
// ─── Main Component (Agent - Read-Only with Share) ──────
// ═════════════════════════════════════════════════════════
const ColonyLayoutMap = ({ mapId, plots, layoutConfig, userSponsorCode }) => {
  const navigate = useNavigate();
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const config = useMemo(() => {
    if (!layoutConfig) return null;
    try { return typeof layoutConfig === 'string' ? JSON.parse(layoutConfig) : layoutConfig; }
    catch { return null; }
  }, [layoutConfig]);

  const plotLookup = useMemo(() => {
    const m = {};
    (plots || []).forEach(p => {
      const key = parseGridKey(p.polygon_points);
      if (key) m[key] = p;
    });
    return m;
  }, [plots]);

  const existingKeys = useMemo(() => new Set(Object.keys(plotLookup)), [plotLookup]);

  const stats = useMemo(() => {
    const s = {};
    (plots || []).forEach(p => { s[p.status] = (s[p.status] || 0) + 1; });
    return s;
  }, [plots]);

  const handlePlotClick = useCallback((plot, gridKey) => {
    if (!plot?.id) return;
    setSelectedPlot({ ...plot, _gridKey: gridKey });
    setViewOpen(true);
    setLinkCopied(false);
  }, []);

  const handleShare = async () => {
    if (!selectedPlot?.id) return;
    const refParam = userSponsorCode ? `?ref=${userSponsorCode}` : '';
    const shareUrl = `${window.location.origin}/share/plot/${selectedPlot.id}${refParam}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Plot ${selectedPlot.plot_number || selectedPlot._gridKey}`,
          text: `Check out this plot — ${selectedPlot.plot_number || 'Available'}`,
          url: shareUrl,
        });
        return;
      } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      toast.success('Share link copied!');
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      window.prompt('Copy this link:', shareUrl);
    }
  };

  if (!config) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
        <p className="text-slate-500 font-medium">This map has no layout configuration.</p>
        <p className="text-sm text-slate-400 mt-1">Contact admin to set up the colony layout.</p>
      </div>
    );
  }

  const { topLeft, topRight, bottomLeft, bottomRight, roadEvery = 2, roadRowOffset = 0, excludedRoads = [] } = config;
  const topRows = Math.max(topLeft?.rows || 0, topRight?.rows || 0);
  const bottomRows = Math.max(bottomLeft?.rows || 0, bottomRight?.rows || 0);

  const renderRow = (leftQ, rightQ, r, leftCols, rightCols, leftMaxRows, rightMaxRows) => {
    const leftPlots = [];
    const rightPlots = [];
    if (r < leftMaxRows) {
      for (let c = 0; c < leftCols; c++) {
        const key = `${leftQ}-${r}-${c}`;
        if (existingKeys.has(key)) leftPlots.push(<PlotBox key={key} plot={plotLookup[key]} gridKey={key} onClick={handlePlotClick} />);
      }
    }
    if (r < rightMaxRows) {
      for (let c = 0; c < rightCols; c++) {
        const key = `${rightQ}-${r}-${c}`;
        if (existingKeys.has(key)) rightPlots.push(<PlotBox key={key} plot={plotLookup[key]} gridKey={key} onClick={handlePlotClick} />);
      }
    }
    if (leftPlots.length === 0 && rightPlots.length === 0) return null;
    return (
      <div key={`row-${leftQ}-${r}`} className="flex items-stretch gap-0">
        <div className="flex gap-0.5" style={{ width: '44%' }}>
          {leftPlots.length > 0 ? leftPlots : <div className="flex-1" />}
        </div>
        <div className="bg-linear-to-b from-slate-700/60 via-slate-600/60 to-slate-700/60 shrink-0 flex items-center justify-center relative"
          style={{ width: '3%', minWidth: '14px' }}>
          <div className="w-px h-full bg-yellow-400/15" />
        </div>
        <div className="flex gap-0.5" style={{ width: '53%' }}>
          {rightPlots.length > 0 ? rightPlots : <div className="flex-1" />}
        </div>
      </div>
    );
  };

  const buildHalf = (leftQ, rightQ, totalRows, leftCfg, rightCfg) => {
    const els = [];
    for (let r = 0; r < totalRows; r++) {
      const adjustedRow = r + roadRowOffset;
      if (r > 0 && roadEvery > 0 && adjustedRow % roadEvery === 0) {
        const roadKey = `${leftQ}-${r}`;
        if (!excludedRoads.includes(roadKey)) {
          els.push(<RoadStrip key={`road-${roadKey}`} />);
        }
      }
      const row = renderRow(leftQ, rightQ, r, leftCfg?.cols || 0, rightCfg?.cols || 0, leftCfg?.rows || 0, rightCfg?.rows || 0);
      if (row) els.push(row);
    }
    return els;
  };

  const shareUrl = selectedPlot?.id
    ? `${window.location.origin}/share/plot/${selectedPlot.id}${userSponsorCode ? `?ref=${userSponsorCode}` : ''}`
    : '';

  return (
    <div className="space-y-3">
      <StatusLegend stats={stats} total={plots?.length || 0} />
      <TreeBorder />

      {/* Map Container */}
      <div className="bg-[#1a2e1a] rounded-2xl p-3 sm:p-4 overflow-x-auto border border-slate-700 shadow-xl">
        <div className="min-w-175">
          <div className="text-center py-2 mb-2">
            <h3 className="text-white/70 text-[11px] font-bold tracking-[0.2em] uppercase">
              Colony Layout Plan
            </h3>
          </div>
          <div className="flex flex-col gap-0.5">
            {buildHalf('TL', 'TR', topRows, topLeft, topRight)}
            <RoadStrip isMain />
            {buildHalf('BL', 'BR', bottomRows, bottomLeft, bottomRight)}
          </div>
        </div>
      </div>

      <TreeBorder />
      <div className="bg-linear-to-r from-slate-200 via-slate-300 to-slate-200 rounded-lg h-3 flex items-center justify-center overflow-hidden">
        <div className="w-full border-t border-dashed border-slate-400/30" />
      </div>

      {/* Plot View & Share Dialog (read-only) */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-110 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              Plot {selectedPlot?.plot_number || selectedPlot?._gridKey}
              {selectedPlot?.status && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white uppercase"
                  style={{ backgroundColor: STATUS_MAP[selectedPlot.status]?.color }}>
                  {STATUS_MAP[selectedPlot.status]?.label}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedPlot && (
            <div className="space-y-4 py-2">
              {/* Share Link */}
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Share2 className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Share This Plot</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input value={shareUrl} readOnly className="h-8 text-xs rounded-lg bg-white text-slate-600 flex-1" />
                  <Button size="sm" onClick={handleShare}
                    className={`rounded-lg h-8 px-3 text-xs cursor-pointer ${linkCopied ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}>
                    {linkCopied ? <><Check className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
                  </Button>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="rounded-lg h-8 px-2 cursor-pointer">
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </a>
                </div>
                {userSponsorCode && (
                  <p className="text-[10px] text-blue-500 mt-1.5">
                    Agent code: <span className="font-bold">{userSponsorCode}</span> — bookings via this link are attributed to you
                  </p>
                )}
              </div>

              {/* Plot Details (read-only) */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Plot Details</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selectedPlot.block && (
                    <div><span className="text-xs text-slate-400">Block:</span> <span className="font-medium text-slate-700">{selectedPlot.block}</span></div>
                  )}
                  {selectedPlot.dimensions && (
                    <div><span className="text-xs text-slate-400">Dimensions:</span> <span className="font-medium text-slate-700">{selectedPlot.dimensions}</span></div>
                  )}
                  {selectedPlot.area_sqft && (
                    <div><span className="text-xs text-slate-400">Area:</span> <span className="font-medium text-slate-700">{selectedPlot.area_sqft} sqft</span></div>
                  )}
                  {selectedPlot.facing && (
                    <div><span className="text-xs text-slate-400">Facing:</span> <span className="font-medium text-slate-700">{selectedPlot.facing}</span></div>
                  )}
                  {selectedPlot.plot_type && (
                    <div><span className="text-xs text-slate-400">Type:</span> <span className="font-medium text-slate-700">{selectedPlot.plot_type}</span></div>
                  )}
                  {selectedPlot.total_price && (
                    <div><span className="text-xs text-slate-400">Price:</span> <span className="font-bold text-emerald-700">₹{Number(selectedPlot.total_price).toLocaleString('en-IN')}</span></div>
                  )}
                </div>
                {selectedPlot.owner_name && (
                  <div className="bg-slate-50 rounded-lg p-2.5 text-sm">
                    <span className="text-xs text-slate-400">Owner:</span> <span className="font-medium text-slate-700">{selectedPlot.owner_name}</span>
                  </div>
                )}
              </div>

              {/* Action: View Full Details */}
              <Button
                variant="outline"
                className="w-full rounded-xl cursor-pointer"
                onClick={() => { setViewOpen(false); navigate(`/colony-maps/${mapId}/plots/${selectedPlot.id}`); }}
              >
                View Full Plot Details →
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ColonyLayoutMap;
