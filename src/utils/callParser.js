export function formatCallType(callType) {
  const labels = {
    INCOMING: 'Incoming Call',
    OUTGOING: 'Outgoing Call',
    MISSED: 'Missed Call',
    UNKNOWN: 'Unknown',
  };
  return labels[callType] ?? callType;
}

export function formatCallDuration(seconds) {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatCallTimestamp(epochMs) {
  if (!epochMs) return '';
  return new Date(epochMs).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function callTypeToLeadSource(_callType) {
  return 'Other';
}

export function defaultLeadName(phoneNumber) {
  if (!phoneNumber || phoneNumber === '' || phoneNumber.toLowerCase() === 'unknown') {
    return '';
  }
  return `Unknown (${phoneNumber})`;
}
