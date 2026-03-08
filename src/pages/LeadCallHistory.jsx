import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, Phone, PhoneIncoming, PhoneOutgoing, Calendar, Clock,
  User, Mail, MapPin, FileText, PhoneMissed,
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';

const statusColors = {
  Interested: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Follow-up Required': 'bg-amber-100 text-amber-700 border-amber-200',
  'Not Reachable': 'bg-red-100 text-red-700 border-red-200',
  'Switched Off': 'bg-gray-100 text-gray-700 border-gray-200',
  'Invalid Number': 'bg-red-100 text-red-700 border-red-200',
  'Call Back Later': 'bg-sky-100 text-sky-700 border-sky-200',
  'Budget Issue': 'bg-orange-100 text-orange-700 border-orange-200',
  'Site Visit Requested': 'bg-violet-100 text-violet-700 border-violet-200',
  'Negotiation Ongoing': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Not Interested': 'bg-slate-100 text-slate-700 border-slate-200',
};

const formatDuration = (s) => {
  if (!s) return '0:00';
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

const LeadCallHistory = () => {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const [leadRes, callsRes] = await Promise.all([
          api.get(`/leads/${leadId}`),
          api.get(`/calls/lead/${leadId}`),
        ]);
        if (leadRes.data.success) setLead(leadRes.data.lead);
        if (callsRes.data.success) setCalls(callsRes.data.calls || []);
      } catch { toast.error('Failed to load call history'); }
      finally { setLoading(false); }
    };
    fetchHistory();
  }, [leadId]);

  if (loading) return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );

  if (!lead) return (
    <div className="text-center py-20">
      <p className="text-slate-500">Lead not found</p>
      <Button variant="outline" className="mt-4 rounded-xl cursor-pointer" onClick={() => navigate('/calls')}>Back to Calls</Button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-lg cursor-pointer">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="h-5 w-px bg-slate-200" />
        <h1 className="text-xl font-bold text-slate-800">Call History</h1>
      </div>

      <Card className="border-0 shadow-sm bg-white overflow-hidden rounded-2xl">
        <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 p-6 border-b border-slate-100">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{lead.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                {lead.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-400" /> {lead.phone}</span>}
                {lead.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-slate-400" /> {lead.email}</span>}
              </div>
            </div>
            <Badge variant="outline" className="bg-white px-3 py-1 font-semibold text-xs rounded-full shadow-sm text-indigo-700 border-indigo-200 uppercase">
              {lead.status?.replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="font-medium text-slate-700">Address</p>
              <p className="text-slate-500">{lead.address || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="font-medium text-slate-700">Assigned Agent</p>
              <p className="text-slate-500">{lead.assigned_to_name || 'You'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 sm:col-span-2">
            <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <p className="font-medium text-slate-700">Notes</p>
              <p className="text-slate-500 bg-slate-50 p-3 rounded-lg mt-1 border border-slate-100">{lead.notes || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 pt-2">
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" /> Interaction Timeline
        </h3>

        {calls.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100/50 flex flex-col items-center">
            <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
              <PhoneMissed className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">No calls logged yet.</p>
            <Button variant="outline" className="mt-4 bg-white" onClick={() => navigate('/calls/log')}>Log First Call</Button>
          </div>
        ) : (
          <div className="relative border-l-2 border-indigo-100 ml-4 space-y-6 pb-4">
            {calls.map((call) => (
              <div key={call.id} className="relative pl-6">
                <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white bg-indigo-500 shadow-sm" />
                <Card className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {call.call_type === 'INCOMING'
                            ? <PhoneIncoming className="w-5 h-5 text-emerald-500" />
                            : <PhoneOutgoing className="w-5 h-5 text-indigo-500" />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{fmtDate(call.call_start)} at {fmtTime(call.call_start)}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3" /> You
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1.5">
                        <Badge variant="outline" className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${statusColors[call.outcome_label] || 'bg-slate-100 text-slate-700'}`}>
                          {call.outcome_label || 'Unknown'}
                        </Badge>
                        <span className="text-xs font-mono bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                          {formatDuration(call.duration_seconds)}
                        </span>
                      </div>
                    </div>
                    {call.customer_notes && (
                      <div className="mb-3 bg-amber-50/50 p-3 rounded-xl border border-amber-100/50 text-sm">
                        <p className="font-medium text-amber-800 text-xs uppercase mb-1"><FileText className="w-3.5 h-3.5 inline mr-1" />Notes</p>
                        <p className="text-slate-700">{call.customer_notes}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs">
                      {call.next_action && call.next_action !== 'NONE' && (
                        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500">Next:</span>
                          <span className="font-bold text-slate-700">{call.next_action}</span>
                        </div>
                      )}
                      {call.buying_timeline && (
                        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500">Timeline:</span>
                          <span className="font-semibold text-slate-700">{call.buying_timeline}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadCallHistory;
