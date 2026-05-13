import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { UploadCloud, X, ImagePlus, Loader2 } from 'lucide-react';
import api from '@/lib/axios';

// Compress an image file in-browser using the canvas API.
// Produces a JPEG blob, keeping the longest edge under `maxEdge` px
// and re-encoding at the given quality. Never upscales the source.
// Returns { blob, fileName, width, height, originalSize, compressedSize }
const compressImage = (file, { maxEdge = 1600, quality = 0.78 } = {}) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        // white background for transparent PNGs so JPEG doesn't show black
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) return reject(new Error('Compression failed'));
            const base = file.name.replace(/\.[^.]+$/, '');
            resolve({
              blob,
              fileName: `${base}.jpg`,
              width: w,
              height: h,
              originalSize: file.size,
              compressedSize: blob.size,
            });
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });

const fmtSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// value = [{ url, key?, uploaded_at?, uploaded_by? }]
// onChange receives the updated array
const ImageUploader = ({
  value = [],
  onChange,
  max = 8,
  label = 'Photos',
  hint = 'JPG / PNG up to 10 MB — auto-compressed before upload',
  accent = 'indigo',
  disabled = false,
  compact = false,
}) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const accentMap = {
    indigo: { ring: 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/40', icon: 'text-indigo-500', chip: 'bg-indigo-100 text-indigo-700' },
    green:  { ring: 'border-green-200 hover:border-green-400 hover:bg-green-50/40',   icon: 'text-green-600',  chip: 'bg-green-100 text-green-700'   },
    blue:   { ring: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/40',      icon: 'text-blue-600',   chip: 'bg-blue-100 text-blue-700'     },
  };
  const a = accentMap[accent] || accentMap.indigo;

  const openPicker = () => { if (!disabled && !uploading) fileInputRef.current?.click(); };

  const handleFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const remaining = max - value.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${max} photos allowed`);
      return;
    }
    const accepted = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.info(`Only ${remaining} more photo${remaining !== 1 ? 's' : ''} allowed — extras skipped`);
    }

    setUploading(true);
    setProgress(0);

    try {
      // 1. Compress every file in parallel
      const compressed = await Promise.all(
        accepted.map(f => compressImage(f, { maxEdge: 1600, quality: 0.78 }))
      );

      const totalOriginal = compressed.reduce((s, c) => s + c.originalSize, 0);
      const totalCompressed = compressed.reduce((s, c) => s + c.compressedSize, 0);
      const saved = Math.max(0, Math.round((1 - totalCompressed / totalOriginal) * 100));

      // 2. Upload as multipart/form-data — one request for the whole batch
      const fd = new FormData();
      compressed.forEach(c => {
        const f = new File([c.blob], c.fileName, { type: 'image/jpeg' });
        fd.append('files', f);
      });

      const { data } = await api.post('/upload/many?provider=s3', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });

      const urls = data?.urls || [];
      if (urls.length === 0) throw new Error('Upload returned no URLs');

      const nowIso = new Date().toISOString();
      const newItems = urls.map((url, i) => ({
        url,
        key: data?.public_ids?.[i] || null,
        uploaded_at: nowIso,
      }));

      onChange?.([...(value || []), ...newItems]);
      toast.success(
        `${newItems.length} photo${newItems.length !== 1 ? 's' : ''} uploaded${saved > 0 ? ` · ${saved}% smaller` : ''}`
      );
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Image upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [max, value, onChange]);

  const removeAt = (idx) => {
    const next = [...value];
    next.splice(idx, 1);
    onChange?.(next);
  };

  // Drag & drop
  const [dragOver, setDragOver] = useState(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    handleFiles(e.dataTransfer.files);
  };

  const count = value.length;

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Drop zone / add button */}
      {count < max && (
        <div
          onClick={openPicker}
          onDragOver={(e) => { e.preventDefault(); if (!disabled && !uploading) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors p-4 text-center
            ${dragOver ? 'border-indigo-400 bg-indigo-50/50' : a.ring}
            ${(disabled || uploading) ? 'pointer-events-none opacity-60' : ''}
            ${compact ? 'py-3' : 'py-6'}`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className={`h-5 w-5 animate-spin ${a.icon}`} />
              <p className="text-xs font-medium text-muted-foreground">
                Compressing &amp; uploading… {progress}%
              </p>
              <div className="w-40 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${a.chip}`}>
                <ImagePlus className={`h-5 w-5 ${a.icon}`} />
              </div>
              <p className="text-sm font-medium text-foreground">
                {count === 0 ? `Add ${label.toLowerCase()}` : `Add more ${label.toLowerCase()}`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Click or drag &amp; drop — {hint}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                {count}/{max} added
              </p>
            </div>
          )}
        </div>
      )}

      {/* Thumbnails */}
      {count > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {value.map((att, i) => (
            <div
              key={`${att.url}-${i}`}
              className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/30 group"
            >
              <img
                src={att.url}
                alt={`upload-${i}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeAt(i); }}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity"
                  aria-label="Remove photo"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {count >= max && (
            <div className="col-span-full text-[11px] text-muted-foreground text-center py-1">
              Maximum of {max} photos reached
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Read-only gallery of attachments with lightbox viewer
export const ImageGallery = ({ attachments = [], title = 'Photos', emptyMessage = 'No photos' }) => {
  const [openIdx, setOpenIdx] = useState(null);
  const isOpen = openIdx !== null;

  if (!attachments || attachments.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">{emptyMessage}</p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
        {attachments.map((att, i) => (
          <button
            type="button"
            key={`${att.url}-${i}`}
            onClick={() => setOpenIdx(i)}
            className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/30 hover:ring-2 hover:ring-indigo-300 transition"
          >
            <img
              src={att.url}
              alt={`${title}-${i}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setOpenIdx(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={(e) => { e.stopPropagation(); setOpenIdx(null); }}
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="max-w-5xl max-h-[90vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={attachments[openIdx].url}
              alt={`${title}-viewer`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
          {attachments.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
              {attachments.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setOpenIdx(i); }}
                  className={`w-2 h-2 rounded-full ${i === openIdx ? 'bg-white' : 'bg-white/40 hover:bg-white/70'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

// Small inline preview strip — used on the task card so attachments are visible at a glance
export const AttachmentStrip = ({ attachments = [], max = 4, label, icon: Icon, accent = 'bg-muted/50 text-muted-foreground' }) => {
  if (!attachments || attachments.length === 0) return null;
  const shown = attachments.slice(0, max);
  const extra = attachments.length - shown.length;
  return (
    <div className="inline-flex items-center gap-1.5">
      {label && Icon && (
        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${accent}`}>
          <Icon className="h-3 w-3" /> {label}
        </span>
      )}
      <div className="flex -space-x-1.5">
        {shown.map((att, i) => (
          <img
            key={`${att.url}-${i}`}
            src={att.url}
            alt=""
            className="w-6 h-6 rounded-md object-cover border-2 border-white shadow-sm"
            loading="lazy"
          />
        ))}
        {extra > 0 && (
          <span className="w-6 h-6 rounded-md border-2 border-white shadow-sm bg-muted text-[10px] font-semibold flex items-center justify-center text-muted-foreground">
            +{extra}
          </span>
        )}
      </div>
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export { fmtSize };
export default ImageUploader;
