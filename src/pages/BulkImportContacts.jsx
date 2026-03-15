import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import api from '@/lib/axios';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    ArrowLeft, FileSpreadsheet, Upload, DownloadCloud, CheckCircle2, XCircle,
    AlertCircle, Loader2, Users, Contact,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TEMPLATE_HEADERS = ['name*', 'phone*'];
const TEMPLATE_EXAMPLE = ['Ravi Sharma', '9876543210'];

const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
    ws['!cols'] = [{ wch: 24 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');

    const notesWs = XLSX.utils.aoa_to_sheet([
        ['Column Instructions'],
        ['name*  — Required. Full name of the contact.'],
        ['phone* — Required. Mobile / phone number.'],
        [''],
        ['NOTE: Do NOT change column headers. Rows with missing phone will be skipped.'],
        ['Duplicate phone numbers (already in contacts or leads) will be skipped.'],
    ]);
    notesWs['!cols'] = [{ wch: 70 }];
    XLSX.utils.book_append_sheet(wb, notesWs, 'Instructions');

    XLSX.writeFile(wb, 'agent_contacts_template.xlsx');
    toast.success('Template downloaded!');
};

const BulkImportContacts = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [dragOver, setDragOver] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewRows, setPreviewRows] = useState([]);
    const [parseError, setParseError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [result, setResult] = useState(null);

    const parseFilePreview = useCallback((file) => {
        setParseError('');
        setPreviewRows([]);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
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
        setResult(null);
        setUploadError('');
        parseFilePreview(file);
    }, [parseFilePreview]);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFileSelect(file);
    }, [onFileSelect]);

    const handleUpload = async () => {
        if (!selectedFile) return;
        setUploadError('');
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', selectedFile);
            const { data } = await api.post('/contacts/bulk/upload', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (data.success) {
                setResult(data);
                toast.success(`${data.imported} contacts imported`);
                if (data.failed > 0) {
                    toast.warning(`${data.failed} rows skipped`);
                }
            }
        } catch (err) {
            setUploadError(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const reset = () => {
        setSelectedFile(null);
        setPreviewRows([]);
        setParseError('');
        setResult(null);
        setUploadError('');
    };

    const isDone = !!result;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/all-contacts')} className="rounded-xl">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-lg font-semibold text-slate-800">Bulk Import Contacts</h1>
                    <p className="text-xs text-muted-foreground">Upload an Excel file with name & phone columns</p>
                </div>
            </div>

            {/* Sub-page tabs */}
            <div className="flex items-center gap-1 border-b border-border/50 pb-0">
                <div className="flex items-center gap-1 px-1 py-1 bg-muted/40 rounded-xl">
                    <Link to="/all-contacts" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-slate-700 hover:bg-white/60 transition-colors">
                        <Users className="h-3.5 w-3.5" />
                        All Contacts
                    </Link>
                    <Link to="/all-contacts/bulk" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white shadow-sm text-indigo-700 border border-border/60">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Bulk Import
                    </Link>
                </div>
            </div>

            {/* Step 1: Template */}
            <Card className="card-elevated border-0">
                <CardContent className="py-5 px-5">
                    <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                            <DownloadCloud className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-slate-800 mb-1">Step 1 — Download Template</h3>
                            <p className="text-xs text-muted-foreground mb-3">
                                Download our Excel template, fill in the <strong>name</strong> and <strong>phone</strong> columns, then upload below.
                            </p>
                            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 text-xs h-8 rounded-xl">
                                <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
                                Download Template
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Step 2: Upload */}
            <Card className="card-elevated border-0">
                <CardContent className="py-5 px-5">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                            <Upload className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-800 mb-1">Step 2 — Upload File</h3>
                            <p className="text-xs text-muted-foreground">Drag & drop or click to select your file (max 10 MB)</p>
                        </div>
                    </div>

                    {/* Drop zone */}
                    <div
                        className={cn(
                            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                            dragOver ? 'border-indigo-400 bg-indigo-50/50' : 'border-border/60 hover:border-indigo-300 hover:bg-indigo-50/30',
                            selectedFile && 'border-emerald-400 bg-emerald-50/30'
                        )}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                            onChange={(e) => onFileSelect(e.target.files?.[0])}
                        />
                        {selectedFile ? (
                            <div className="flex flex-col items-center gap-2">
                                <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                                <p className="text-sm font-medium text-emerald-700">{selectedFile.name}</p>
                                <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB · Click to change</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <Upload className="h-8 w-8 text-slate-300" />
                                <p className="text-sm text-slate-500">Drop your Excel / CSV file here or <span className="text-indigo-600 font-medium">browse</span></p>
                            </div>
                        )}
                    </div>

                    {parseError && (
                        <Alert variant="destructive" className="mt-4 bg-red-50 text-red-700 border-red-200"><AlertCircle className="h-4 w-4" /><AlertDescription>{parseError}</AlertDescription></Alert>
                    )}
                    {uploadError && (
                        <Alert variant="destructive" className="mt-4 bg-red-50 text-red-700 border-red-200"><AlertCircle className="h-4 w-4" /><AlertDescription>{uploadError}</AlertDescription></Alert>
                    )}

                    {/* Preview */}
                    {previewRows.length > 0 && !isDone && (
                        <div className="mt-4">
                            <p className="text-xs font-semibold text-slate-600 mb-2">Preview (first {previewRows.length} rows)</p>
                            <div className="overflow-x-auto rounded-lg border border-border/50">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50/80">
                                            {Object.keys(previewRows[0]).map((h) => (
                                                <TableHead key={h} className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 py-2">{h}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewRows.map((row, i) => (
                                            <TableRow key={i}>
                                                {Object.values(row).map((v, j) => (
                                                    <TableCell key={j} className="text-xs py-1.5">{String(v)}</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    {/* Upload button */}
                    {selectedFile && !isDone && (
                        <div className="mt-4 flex justify-end">
                            <Button onClick={handleUpload} disabled={uploading} className="bg-indigo-600 hover:bg-indigo-700 gap-1.5 text-xs h-9 rounded-xl">
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {uploading ? 'Importing...' : 'Upload & Import'}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Results */}
            {isDone && (
                <Card className="card-elevated border-0">
                    <CardContent className="py-5 px-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                            <h3 className="text-sm font-semibold text-emerald-700">Import Complete</h3>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center p-3 rounded-lg bg-slate-50">
                                <p className="text-xl font-bold text-slate-800">{result.totalRows}</p>
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Total Rows</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-emerald-50">
                                <p className="text-xl font-bold text-emerald-700">{result.imported}</p>
                                <p className="text-[10px] font-semibold uppercase text-emerald-600">Imported</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-red-50">
                                <p className="text-xl font-bold text-red-700">{result.failed}</p>
                                <p className="text-[10px] font-semibold uppercase text-red-600">Failed</p>
                            </div>
                        </div>

                        {result.errors?.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-red-600 mb-2">Failed Rows</p>
                                <div className="overflow-x-auto rounded-lg border border-red-200">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-red-50/50">
                                                <TableHead className="text-[10px] uppercase text-red-600">Row</TableHead>
                                                <TableHead className="text-[10px] uppercase text-red-600">Reason</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {result.errors.map((e, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-xs">{e.row}</TableCell>
                                                    <TableCell className="text-xs text-red-600">{e.reason}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={reset} className="text-xs h-9 rounded-xl gap-1.5">
                                <Upload className="h-3.5 w-3.5" />
                                Import More
                            </Button>
                            <Button onClick={() => navigate('/all-contacts')} className="bg-indigo-600 hover:bg-indigo-700 text-xs h-9 rounded-xl gap-1.5">
                                <Contact className="h-3.5 w-3.5" />
                                View Contacts
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default BulkImportContacts;
