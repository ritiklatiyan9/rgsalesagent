import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '@/lib/axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    ArrowLeft, FileSpreadsheet, Upload, DownloadCloud, CheckCircle2, XCircle,
    AlertCircle, UserPlus, Loader2, ClipboardList, FileX2, RefreshCw, List,
    ArrowRightLeft, History,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TEMPLATE_HEADERS = ['name*', 'phone*', 'email', 'address', 'profession', 'status', 'notes'];
const TEMPLATE_EXAMPLE = ['Ravi Sharma', '9876543210', 'ravi@email.com', 'Mumbai', 'Software Engineer', 'NEW', 'Interested in 3BHK'];
const STATUS_VALUES    = ['NEW', 'CONTACTED', 'INTERESTED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED', 'LOST'];

const downloadTemplate = () => {
    const wb   = XLSX.utils.book_new();
    const data = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE];
    const ws   = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [20, 16, 26, 22, 22, 16, 30].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');

    const notesData = [
        ['Column Instructions'],
        ['name*  — Required. Full name of the lead.'],
        ['phone* — Required. Mobile / phone number.'],
        ['email  — Optional.'],
        ['address — Optional. City / area.'],
        ['profession — Optional.'],
        [`status — Optional. One of: ${STATUS_VALUES.join(', ')}. Defaults to NEW.`],
        ['notes  — Optional. Any remarks.'],
        [''],
        ['NOTE: Do NOT change column headers. Rows with missing name or phone will be skipped.'],
    ];
    const notesWs = XLSX.utils.aoa_to_sheet(notesData);
    notesWs['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, notesWs, 'Instructions');

    XLSX.writeFile(wb, 'leads_bulk_template.xlsx');
    toast.success('Template downloaded!');
};

const JobStatusBadge = ({ state }) => {
    const MAP = {
        QUEUED:     { label: 'Queued',     cls: 'bg-yellow-100 text-yellow-700' },
        PROCESSING: { label: 'Processing', cls: 'bg-blue-100 text-blue-700' },
        COMPLETED:  { label: 'Completed',  cls: 'bg-emerald-100 text-emerald-700' },
        FAILED:     { label: 'Failed',     cls: 'bg-red-100 text-red-700' },
    };
    const info = MAP[state] || { label: state ?? 'Queued', cls: 'bg-yellow-100 text-yellow-700' };
    return <Badge className={cn('rounded-full text-xs font-semibold', info.cls)}>{info.label}</Badge>;
};

const BulkLeads = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [dragOver, setDragOver]       = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewRows, setPreviewRows] = useState([]);
    const [parseError, setParseError]   = useState('');

    const [uploading, setUploading]     = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [jobId, setJobId]             = useState(null);
    const [jobResult, setJobResult]     = useState(null);
    const [jobProgress, setJobProgress] = useState(null);
    const pollRef = useRef(null);

    const parseFilePreview = useCallback((file) => {
        setParseError('');
        setPreviewRows([]);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb   = XLSX.read(e.target.result, { type: 'array' });
                const ws   = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                if (!rows.length) return setParseError('File appears to be empty');
                setPreviewRows(rows.slice(0, 10));
            } catch {
                setParseError('Cannot parse this file. Please use the provided template.');
            }
        };
        reader.readAsArrayBuffer(file);
    }, []);

    const onFileSelect = useCallback((file) => {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            return setParseError('Only .xlsx, .xls, and .csv files are supported');
        }
        setSelectedFile(file);
        setJobId(null);
        setJobResult(null);
        setJobProgress(null);
        setUploadError('');
        parseFilePreview(file);
    }, [parseFilePreview]);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFileSelect(file);
    }, [onFileSelect]);

    const startPolling = useCallback((id) => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
            try {
                const { data } = await api.get(`/leads/bulk/status/${id}`);
                if (data.success) {
                    setJobProgress(data);
                    if (data.status === 'COMPLETED' || data.status === 'FAILED') {
                        clearInterval(pollRef.current);
                        setJobResult(data);
                        if (data.status === 'COMPLETED') {
                            toast.success(`Import complete — ${data.processedRows ?? '?'} leads added`);
                        } else {
                            toast.error(`Import failed — ${data.errorMessage || 'Unknown error'}`);
                        }
                    }
                }
            } catch { /* ignore poll errors */ }
        }, 2000);
    }, []);

    useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

    const handleUpload = async () => {
        if (!selectedFile) return;
        setUploadError('');
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', selectedFile);
            const { data } = await api.post('/leads/bulk/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (data.success) {
                setJobId(data.jobId);
                setJobProgress({ percent: 0, status: 'QUEUED', totalRows: data.validCount, processedRows: 0, failedRows: 0 });
                startPolling(data.jobId);
                toast.success(`${data.validCount} rows queued for import`);
                if (data.invalidCount > 0) {
                    toast.warning(`${data.invalidCount} rows skipped (missing name or phone)`);
                }
            }
        } catch (err) {
            setUploadError(err.response?.data?.message || 'Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const reset = () => {
        setSelectedFile(null);
        setPreviewRows([]);
        setParseError('');
        setJobId(null);
        setJobResult(null);
        setJobProgress(null);
        setUploadError('');
        if (pollRef.current) clearInterval(pollRef.current);
    };

    const isDone = jobResult?.status === 'COMPLETED';

    return (
        <div className="space-y-4 sm:space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate('/leads')} className="rounded-xl shrink-0 h-9 w-9">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                        <FileSpreadsheet className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-base sm:text-lg font-semibold tracking-tight text-slate-800 leading-tight">Bulk Import Leads</h1>
                        <p className="text-[11px] sm:text-xs text-muted-foreground truncate">Upload Excel/CSV — processed in background</p>
                    </div>
                </div>
            </div>

            {/* Sub-page tabs */}
            <div className="-mx-1 px-1 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-center gap-1 px-1 py-1 bg-muted/40 rounded-xl min-w-max">
                    <Link to="/leads" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
                        <List className="h-3.5 w-3.5" /> My Leads
                    </Link>
                    <Link to="/leads/add" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
                        <UserPlus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Add</span> Lead
                    </Link>
                    <Link to="/leads/bulk" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-indigo-700 border border-border/60 whitespace-nowrap">
                        <FileSpreadsheet className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Bulk</span> Import
                    </Link>
                    <Link to="/leads/assign" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
                        <ArrowRightLeft className="h-3.5 w-3.5" /> Assign
                    </Link>
                    <Link to="/leads/assignment-history" className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors whitespace-nowrap">
                        <History className="h-3.5 w-3.5" /> History
                    </Link>
                </div>
            </div>

            {/* Step 1 — Download template */}
            <Card className="border-0 card-elevated">
                <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                            <DownloadCloud className="h-4.5 w-4.5 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">Step 1 — Download the Template</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                        Use our Excel template. <strong className="text-slate-700">name</strong> and <strong className="text-slate-700">phone</strong> are required. Other columns are optional.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={downloadTemplate}
                                    className="gap-1.5 rounded-xl shrink-0 text-xs h-8 px-2.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300"
                                >
                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Download</span> Template
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {TEMPLATE_HEADERS.map(h => (
                                    <Badge
                                        key={h}
                                        variant="outline"
                                        className={cn(
                                            'rounded-md text-[10px] font-mono px-1.5 py-0',
                                            h.endsWith('*')
                                                ? 'border-red-300 text-red-600 bg-red-50'
                                                : 'border-slate-200 text-slate-500 bg-slate-50'
                                        )}
                                    >
                                        {h}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Step 2 — Upload file */}
            {!jobId && (
                <Card className="border-0 card-elevated">
                    <CardContent className="p-4 sm:p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                <Upload className="h-4 w-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Step 2 — Upload Your File</p>
                                <p className="text-xs text-muted-foreground">Supports .xlsx, .xls and .csv • Max 10 MB</p>
                            </div>
                        </div>

                        {/* Drop zone */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={onDrop}
                            className={cn(
                                'border-2 border-dashed rounded-2xl py-7 sm:py-10 px-4 text-center cursor-pointer transition-all select-none',
                                dragOver
                                    ? 'border-indigo-400 bg-indigo-50'
                                    : selectedFile
                                        ? 'border-indigo-400 bg-indigo-50/60'
                                        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/50'
                            )}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                onChange={e => onFileSelect(e.target.files?.[0])}
                            />
                            {selectedFile ? (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="h-11 w-11 rounded-2xl bg-indigo-100 flex items-center justify-center">
                                        <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <p className="text-sm font-semibold text-indigo-700 truncate max-w-[200px]">{selectedFile.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {(selectedFile.size / 1024).toFixed(1)} KB •{' '}
                                        <span className="underline text-blue-500">tap to change</span>
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2.5">
                                    <div className="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center">
                                        <Upload className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">
                                            Tap to select file
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">or drag & drop — .xlsx · .xls · .csv</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {parseError && (
                            <Alert variant="destructive" className="rounded-xl">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{parseError}</AlertDescription>
                            </Alert>
                        )}

                        {uploadError && (
                            <Alert variant="destructive" className="rounded-xl">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{uploadError}</AlertDescription>
                            </Alert>
                        )}

                        {/* Preview */}
                        {previewRows.length > 0 && !parseError && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Preview (first {previewRows.length} rows)
                                </p>
                                <div className="rounded-xl border overflow-auto max-h-64">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                {Object.keys(previewRows[0]).slice(0, 7).map(h => (
                                                    <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewRows.map((row, i) => (
                                                <TableRow key={i} className="text-xs">
                                                    {Object.values(row).slice(0, 7).map((v, j) => (
                                                        <TableCell key={j} className="py-1.5 whitespace-nowrap max-w-[150px] truncate">
                                                            {String(v)}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 sm:gap-3 sm:justify-end">
                            {selectedFile && (
                                <Button variant="outline" size="sm" onClick={reset} className="rounded-xl gap-2 flex-1 sm:flex-none">
                                    <FileX2 className="h-4 w-4" />
                                    Clear
                                </Button>
                            )}
                            <Button
                                onClick={handleUpload}
                                disabled={!selectedFile || uploading || !!parseError}
                                className={cn("rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700", selectedFile ? "flex-1 sm:flex-none" : "w-full")}
                            >
                                {uploading ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                                ) : (
                                    <><Upload className="h-4 w-4" /> Start Import</>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 3 — Progress & Result */}
            {jobId && (
                <Card className="border-0 card-elevated">
                    <CardContent className="p-4 sm:p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                                    isDone ? 'bg-emerald-50' : 'bg-indigo-50'
                                )}>
                                    {isDone
                                        ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                        : <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
                                    }
                                </div>
                                <div>
                                    <p className="text-sm font-semibold">Import Status</p>
                                    <p className="text-[11px] text-muted-foreground font-mono">Job #{jobId}</p>
                                </div>
                            </div>
                            <JobStatusBadge state={jobProgress?.status || 'QUEUED'} />
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>
                                    {isDone
                                        ? `${jobResult?.processedRows ?? 0} inserted · ${jobResult?.failedRows ?? 0} failed`
                                        : `Processing ${jobProgress?.processedRows ?? 0} / ${jobProgress?.totalRows ?? '?'} leads`
                                    }
                                </span>
                                <span className="font-medium">{jobProgress?.percent ?? 0}%</span>
                            </div>
                            <Progress
                                value={jobProgress?.percent ?? 0}
                                className={cn('h-2 rounded-full', isDone && '[&>div]:bg-emerald-500')}
                            />
                        </div>

                        {/* Summary cards */}
                        {isDone && (
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <div className="rounded-xl bg-slate-50 p-3 text-center space-y-0.5 border border-slate-200/60">
                                    <p className="text-xl sm:text-2xl font-bold text-slate-700">{jobResult?.totalRows ?? 0}</p>
                                    <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Total Rows</p>
                                </div>
                                <div className="rounded-xl bg-emerald-50 p-3 text-center space-y-0.5 border border-emerald-200/60">
                                    <p className="text-xl sm:text-2xl font-bold text-emerald-700">{jobResult?.processedRows ?? 0}</p>
                                    <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Imported</p>
                                </div>
                                <div className="rounded-xl bg-red-50 p-3 text-center space-y-0.5 border border-red-200/60">
                                    <p className="text-xl sm:text-2xl font-bold text-red-600">{jobResult?.failedRows ?? 0}</p>
                                    <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium">Failed</p>
                                </div>
                            </div>
                        )}

                        {/* Failed rows detail */}
                        {isDone && jobResult?.failedDetails?.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <XCircle className="h-3.5 w-3.5" />
                                    Failed Rows ({jobResult.failedDetails.length})
                                </p>
                                <div className="rounded-xl border border-red-100 overflow-auto max-h-52">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-red-50/50">
                                                <TableHead className="text-xs w-16">Row</TableHead>
                                                <TableHead className="text-xs">Name</TableHead>
                                                <TableHead className="text-xs">Reason</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {jobResult.failedDetails.map((row, i) => (
                                                <TableRow key={i} className="text-xs">
                                                    <TableCell className="font-mono text-red-500">#{row.row}</TableCell>
                                                    <TableCell>{row.name}</TableCell>
                                                    <TableCell className="text-muted-foreground max-w-xs truncate">{row.error}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                            <Button variant="outline" size="sm" onClick={reset} className="rounded-xl gap-2 sm:flex-none">
                                <RefreshCw className="h-4 w-4" />
                                Import Another File
                            </Button>
                            {isDone && (
                                <Button
                                    size="sm"
                                    onClick={() => navigate('/leads')}
                                    className="rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700 sm:flex-none"
                                >
                                    <ClipboardList className="h-4 w-4" />
                                    View All Leads
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default BulkLeads;
