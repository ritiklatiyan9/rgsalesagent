import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import api from '@/lib/axios';
import { toast } from 'sonner';
import {
  Send, Upload, FileText, Trash2, Search, User, Phone,
  Loader2, ChevronLeft, ChevronRight, MessageSquare, File,
  Plus, Eye, CheckCircle2, Share2,
} from 'lucide-react';

const WhatsAppIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const statusColors = {
  NEW: 'bg-blue-100 text-blue-700 border-blue-200',
  CONTACTED: 'bg-amber-100 text-amber-700 border-amber-200',
  INTERESTED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SITE_VISIT: 'bg-violet-100 text-violet-700 border-violet-200',
  NEGOTIATION: 'bg-purple-100 text-purple-700 border-purple-200',
  BOOKED: 'bg-green-100 text-green-700 border-green-200',
  LOST: 'bg-slate-100 text-slate-700 border-slate-200',
};

const ContentShare = () => {
  // ── Content state ──
  const [contents, setContents] = useState([]);
  const [loadingContents, setLoadingContents] = useState(true);
  const [activeTab, setActiveTab] = useState('create');

  // ── Create form ──
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [creating, setCreating] = useState(false);

  // ── Share modal ──
  const [shareModal, setShareModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadPagination, setLeadPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [sentLeads, setSentLeads] = useState(new Set());

  // ── Preview modal ──
  const [previewModal, setPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);

  // ── Fetch saved contents ──
  const fetchContents = useCallback(async () => {
    setLoadingContents(true);
    try {
      const { data } = await api.get('/content-share');
      if (data.success) setContents(data.contents);
    } catch {
      toast.error('Failed to load saved contents');
    } finally {
      setLoadingContents(false);
    }
  }, []);

  // ── Fetch leads ──
  const fetchLeads = useCallback(async (page = 1, search = '') => {
    setLoadingLeads(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '50');
      if (search) params.set('search', search);
      const { data } = await api.get(`/content-share/leads?${params}`);
      if (data.success) {
        setLeads(data.leads);
        setLeadPagination(data.pagination);
      }
    } catch {
      toast.error('Failed to load leads');
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  // ── Create content ──
  const handleCreate = async () => {
    if (!message && !file) {
      toast.error('Please type a message or upload a PDF');
      return;
    }
    setCreating(true);
    try {
      const formData = new FormData();
      if (title) formData.append('title', title);
      if (message) formData.append('message', message);
      if (file) formData.append('file', file);

      const { data } = await api.post('/content-share', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.success) {
        toast.success('Content saved!');
        setTitle('');
        setMessage('');
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById('pdf-upload');
        if (fileInput) fileInput.value = '';
        fetchContents();
        setActiveTab('library');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save content');
    } finally {
      setCreating(false);
    }
  };

  // ── Delete content ──
  const handleDelete = async (id) => {
    try {
      const { data } = await api.delete(`/content-share/${id}`);
      if (data.success) {
        toast.success('Content deleted');
        setContents((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  // ── Open share modal ──
  const openShareModal = (content) => {
    setSelectedContent(content);
    setSentLeads(new Set());
    setLeadSearch('');
    setShareModal(true);
    fetchLeads(1, '');
  };

  // ── Build WhatsApp URL and open ──
  const shareToWhatsApp = (lead) => {
    if (!lead.phone) {
      toast.error('No phone number');
      return;
    }

    const cleaned = lead.phone.replace(/[^0-9]/g, '');
    const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;

    let waMessage = '';
    if (selectedContent?.message) {
      waMessage += selectedContent.message;
    }
    if (selectedContent?.file_url) {
      if (waMessage) waMessage += '\n\n';
      waMessage += `📄 ${selectedContent.file_name || 'Document'}\n${selectedContent.file_url}`;
    }

    const encoded = encodeURIComponent(waMessage);
    window.open(`https://wa.me/${waNumber}?text=${encoded}`, '_blank');

    // Mark as sent visually
    setSentLeads((prev) => new Set([...prev, lead.id]));
  };

  // ── Share via Quick Share (no saved content — inline) ──
  const [quickMessage, setQuickMessage] = useState('');
  const [quickFile, setQuickFile] = useState(null);
  const [quickShareModal, setQuickShareModal] = useState(false);

  const openQuickShare = () => {
    if (!quickMessage && !quickFile) {
      toast.error('Type a message or select a PDF first');
      return;
    }
    setLeadSearch('');
    setSentLeads(new Set());
    setQuickShareModal(true);
    fetchLeads(1, '');
  };

  const quickShareToWhatsApp = async (lead) => {
    if (!lead.phone) { toast.error('No phone number'); return; }
    const cleaned = lead.phone.replace(/[^0-9]/g, '');
    const waNumber = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;

    let waMessage = quickMessage || '';

    if (quickFile) {
      // Upload file first, then share link
      try {
        const formData = new FormData();
        formData.append('file', quickFile);
        const { data } = await api.post('/upload/single', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (data.success) {
          if (waMessage) waMessage += '\n\n';
          waMessage += `📄 ${quickFile.name}\n${data.url}`;
        }
      } catch {
        toast.error('PDF upload failed');
        return;
      }
    }

    const encoded = encodeURIComponent(waMessage);
    window.open(`https://wa.me/${waNumber}?text=${encoded}`, '_blank');
    setSentLeads((prev) => new Set([...prev, lead.id]));
  };

  // ── Lead list search handler ──
  const handleLeadSearch = (search, page = 1) => {
    setLeadSearch(search);
    fetchLeads(page, search);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
            <Share2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Content Share</h1>
            <p className="text-xs text-muted-foreground">Create content & share to leads via WhatsApp</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-11">
          <TabsTrigger value="create" className="gap-2 text-sm">
            <Plus className="h-4 w-4" /> Create
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-2 text-sm">
            <FileText className="h-4 w-4" /> Library
            {contents.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{contents.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="quick" className="gap-2 text-sm">
            <Send className="h-4 w-4" /> Quick Share
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB: CREATE CONTENT ═══ */}
        <TabsContent value="create" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Title (optional)</Label>
                <Input
                  placeholder="e.g. New Colony Brochure, Offer Details…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Message</Label>
                <Textarea
                  placeholder="Type your message to send to leads…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-32 text-sm resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upload PDF (optional)</Label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="pdf-upload"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-colors text-sm text-slate-600"
                  >
                    <Upload className="h-4 w-4 text-indigo-500" />
                    {file ? file.name : 'Choose PDF file'}
                  </label>
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files[0] || null)}
                  />
                  {file && (
                    <Button variant="ghost" size="sm" onClick={() => { setFile(null); document.getElementById('pdf-upload').value = ''; }} className="text-xs text-red-500 hover:text-red-600">
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              <Button
                onClick={handleCreate}
                disabled={creating || (!message && !file)}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl text-sm font-semibold"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save Content to Library
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: CONTENT LIBRARY ═══ */}
        <TabsContent value="library" className="mt-4 space-y-4">
          {loadingContents ? (
            <div className="space-y-3">
              {Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : contents.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No content yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first content to start sharing</p>
                <Button size="sm" className="mt-4 gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setActiveTab('create')}>
                  <Plus className="h-3.5 w-3.5" /> Create Content
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {contents.map((content) => (
                <Card key={content.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          {content.file_url ? (
                            <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                              <File className="h-4 w-4 text-red-500" />
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                              <MessageSquare className="h-4 w-4 text-blue-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {content.title || (content.message ? content.message.slice(0, 50) + (content.message.length > 50 ? '…' : '') : content.file_name)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(content.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        {content.message && (
                          <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg">{content.message}</p>
                        )}
                        {content.file_name && (
                          <div className="flex items-center gap-1.5 text-xs text-red-600">
                            <File className="h-3 w-3" />
                            <span className="truncate">{content.file_name}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setPreviewContent(content); setPreviewModal(true); }}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openShareModal(content)}
                          className="h-8 gap-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs px-3"
                        >
                          <WhatsAppIcon className="h-3.5 w-3.5" /> Share
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(content.id)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ TAB: QUICK SHARE ═══ */}
        <TabsContent value="quick" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Type a message and/or attach a PDF, then pick leads to send via WhatsApp instantly.
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Message</Label>
                <Textarea
                  placeholder="Type your message…"
                  value={quickMessage}
                  onChange={(e) => setQuickMessage(e.target.value)}
                  className="min-h-28 text-sm resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Attach PDF (optional)</Label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="quick-pdf-upload"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 hover:border-green-300 hover:bg-green-50/50 cursor-pointer transition-colors text-sm text-slate-600"
                  >
                    <Upload className="h-4 w-4 text-green-500" />
                    {quickFile ? quickFile.name : 'Choose PDF file'}
                  </label>
                  <input
                    id="quick-pdf-upload"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => setQuickFile(e.target.files[0] || null)}
                  />
                  {quickFile && (
                    <Button variant="ghost" size="sm" onClick={() => { setQuickFile(null); document.getElementById('quick-pdf-upload').value = ''; }} className="text-xs text-red-500 hover:text-red-600">
                      Remove
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              <Button
                onClick={openQuickShare}
                disabled={!quickMessage && !quickFile}
                className="w-full h-11 bg-green-600 hover:bg-green-700 text-white gap-2 rounded-xl text-sm font-semibold"
              >
                <Send className="h-4 w-4" /> Select Leads & Share on WhatsApp
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ SHARE MODAL (Saved Content → Leads List) ═══ */}
      <Dialog open={shareModal} onOpenChange={setShareModal}>
        <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[92vh] p-0 gap-0 overflow-hidden">
          <div className="sticky top-0 z-10 bg-background border-b px-5 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <WhatsAppIcon className="h-5 w-5 text-green-500" />
                Share to Leads
              </DialogTitle>
              <DialogDescription>
                {selectedContent?.title || 'Content'} — tap the WhatsApp icon to send
              </DialogDescription>
            </DialogHeader>
            {/* Search */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by name or phone…"
                value={leadSearch}
                onChange={(e) => handleLeadSearch(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-5 py-3" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Content preview */}
            {selectedContent && (
              <div className="rounded-xl border border-green-200 bg-green-50/50 p-3 mb-4 space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-green-600">Content to share</p>
                {selectedContent.message && (
                  <p className="text-xs text-slate-700 line-clamp-3">{selectedContent.message}</p>
                )}
                {selectedContent.file_url && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600">
                    <File className="h-3 w-3" /> {selectedContent.file_name}
                  </div>
                )}
              </div>
            )}

            {/* Leads list */}
            {loadingLeads ? (
              <div className="space-y-2">
                {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <User className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No leads found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leads.map((lead) => {
                  const isSent = sentLeads.has(lead.id);
                  return (
                    <div
                      key={lead.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        isSent ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-100 shrink-0">
                          {lead.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{lead.name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span className="font-mono">{lead.phone}</span>
                            {lead.status && (
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${statusColors[lead.status] || ''}`}>
                                {lead.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => shareToWhatsApp(lead)}
                        className={`h-9 gap-1.5 rounded-lg text-xs shrink-0 ${
                          isSent
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                        variant={isSent ? 'outline' : 'default'}
                      >
                        {isSent ? (
                          <><CheckCircle2 className="h-3.5 w-3.5" /> Sent</>
                        ) : (
                          <><WhatsAppIcon className="h-3.5 w-3.5" /> Send</>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!loadingLeads && leadPagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 pb-1">
                <p className="text-xs text-muted-foreground">
                  Page {leadPagination.page} of {leadPagination.totalPages} · {leadPagination.total} leads
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    disabled={leadPagination.page <= 1}
                    onClick={() => fetchLeads(leadPagination.page - 1, leadSearch)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    disabled={leadPagination.page >= leadPagination.totalPages}
                    onClick={() => fetchLeads(leadPagination.page + 1, leadSearch)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ QUICK SHARE MODAL ═══ */}
      <Dialog open={quickShareModal} onOpenChange={setQuickShareModal}>
        <DialogContent className="sm:max-w-lg md:max-w-2xl max-h-[92vh] p-0 gap-0 overflow-hidden">
          <div className="sticky top-0 z-10 bg-background border-b px-5 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-green-500" />
                Quick Share to Leads
              </DialogTitle>
              <DialogDescription>Tap WhatsApp icon next to any lead to send</DialogDescription>
            </DialogHeader>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by name or phone…"
                value={leadSearch}
                onChange={(e) => handleLeadSearch(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-5 py-3" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Quick content preview */}
            <div className="rounded-xl border border-green-200 bg-green-50/50 p-3 mb-4 space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-green-600">Sharing content</p>
              {quickMessage && <p className="text-xs text-slate-700 line-clamp-3">{quickMessage}</p>}
              {quickFile && (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                  <File className="h-3 w-3" /> {quickFile.name}
                </div>
              )}
            </div>

            {loadingLeads ? (
              <div className="space-y-2">
                {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <User className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">No leads found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leads.map((lead) => {
                  const isSent = sentLeads.has(lead.id);
                  return (
                    <div
                      key={lead.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                        isSent ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs border border-indigo-100 shrink-0">
                          {lead.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{lead.name}</p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span className="font-mono">{lead.phone}</span>
                            {lead.status && (
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${statusColors[lead.status] || ''}`}>
                                {lead.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => quickShareToWhatsApp(lead)}
                        className={`h-9 gap-1.5 rounded-lg text-xs shrink-0 ${
                          isSent
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                        variant={isSent ? 'outline' : 'default'}
                      >
                        {isSent ? (
                          <><CheckCircle2 className="h-3.5 w-3.5" /> Sent</>
                        ) : (
                          <><WhatsAppIcon className="h-3.5 w-3.5" /> Send</>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {!loadingLeads && leadPagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 pb-1">
                <p className="text-xs text-muted-foreground">
                  Page {leadPagination.page} of {leadPagination.totalPages} · {leadPagination.total} leads
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    disabled={leadPagination.page <= 1}
                    onClick={() => fetchLeads(leadPagination.page - 1, leadSearch)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    disabled={leadPagination.page >= leadPagination.totalPages}
                    onClick={() => fetchLeads(leadPagination.page + 1, leadSearch)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ PREVIEW MODAL ═══ */}
      <Dialog open={previewModal} onOpenChange={setPreviewModal}>
        <DialogContent className="sm:max-w-md max-h-[80vh] p-0 gap-0 overflow-hidden">
          <div className="sticky top-0 z-10 bg-background border-b px-5 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-indigo-500" />
                Content Preview
              </DialogTitle>
              <DialogDescription>{previewContent?.title || 'Untitled'}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
            {previewContent?.message && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Message</p>
                <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed border border-slate-100">
                  {previewContent.message}
                </div>
              </div>
            )}
            {previewContent?.file_url && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Attached File</p>
                <a
                  href={previewContent.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl border border-red-100 bg-red-50/30 hover:bg-red-50 transition-colors"
                >
                  <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                    <File className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{previewContent.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">Click to open PDF</p>
                  </div>
                </a>
              </div>
            )}
          </div>
          <div className="sticky bottom-0 z-10 bg-background border-t px-5 py-3">
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewModal(false)}>Close</Button>
              <Button onClick={() => { setPreviewModal(false); openShareModal(previewContent); }}
                className="gap-1.5 bg-green-500 hover:bg-green-600 text-white">
                <WhatsAppIcon className="h-4 w-4" /> Share to Leads
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContentShare;
