import api from '@/lib/axios';

export const LEAD_SOURCE_OPTIONS = [
  { value: 'Direct', label: 'Direct' },
  { value: 'Referral', label: 'Referral' },
  { value: 'Website', label: 'Website' },
  { value: 'Advertisement', label: 'Advertisement' },
  { value: 'Event', label: 'Event' },
  { value: 'Other', label: 'Other' },
];

export async function createLead({ name, phone, email, status, notes, lead_source, address, profession }) {
  const body = {
    name,
    phone: phone || null,
    email: email || null,
    status: status || 'NEW',
    notes: notes || null,
    lead_source: lead_source || 'Other',
    address: address || null,
    profession: profession || null,
  };

  const { data } = await api.post('/leads', body);
  return data;
}
