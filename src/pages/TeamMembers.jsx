import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserCheck, Clock, Shield, Crown, ChevronRight } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

const ROLE_BADGE = {
  TEAM_HEAD: 'bg-violet-100 text-violet-700',
  AGENT: 'bg-blue-100 text-blue-700',
};

const StatCard = ({ title, value, icon: Icon, highlight }) => (
  <Card className="card-elevated border-0">
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${highlight ? 'bg-indigo-100' : 'bg-muted'}`}>
        <Icon className={`h-4 w-4 ${highlight ? 'text-indigo-600' : 'text-muted-foreground'}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{title}</p>
        <p className="text-lg font-semibold text-foreground leading-tight">{value ?? '—'}</p>
      </div>
    </CardContent>
  </Card>
);

const SkeletonRows = () =>
  [...Array(5)].map((_, i) => (
    <TableRow key={i}>
      <TableCell className="pl-5"><Skeleton className="h-4 w-5" /></TableCell>
      <TableCell><div className="flex items-center gap-2.5"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-28" /></div></TableCell>
      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
      <TableCell><Skeleton className="h-5 w-16 rounded" /></TableCell>
      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-5 w-12 rounded" /></TableCell>
    </TableRow>
  ));

const TeamMembers = () => {
  const { user, isTeamHead } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      if (!user?.team_id) { setLoading(false); return; }
      try {
        const { data } = await api.get(`/teams/${user.team_id}`);
        if (data.success) {
          setTeam(data.team);
          setMembers(data.members || []);
        }
      } catch { toast.error('Failed to load team'); }
      finally { setLoading(false); }
    };
    fetchTeam();
  }, [user]);

  // Team head detection: use team.head_id, not role (assignTeamHead doesn't change role)
  const isHeadId = (memberId) => team?.head_id && String(team.head_id) === String(memberId);
  const teamHeadMember = members.find(m => isHeadId(m.id));
  const agentCount = members.filter(m => m.role === 'AGENT').length;
  const headCount = teamHeadMember ? 1 : 0;

  if (!loading && !user?.team_id) return (
    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
      <Users className="h-10 w-10 mx-auto mb-3 text-slate-300" />
      <p className="text-slate-500 font-medium">You are not assigned to a team yet.</p>
      <p className="text-sm text-slate-400 mt-1">Contact your admin to be assigned to a team.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title text-xl flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-600" />
          {loading ? 'My Team' : team?.name || 'My Team'} — Members
        </h1>
        <p className="page-subtitle mt-1">
          {members.length} member{members.length !== 1 ? 's' : ''} • {headCount} head{headCount !== 1 ? 's' : ''} • {agentCount} agent{agentCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Total Members" value={loading ? '…' : members.length} icon={Users} />
        <StatCard title="Team Heads" value={loading ? '…' : headCount} icon={Shield} highlight />
        <StatCard title="Agents" value={loading ? '…' : agentCount} icon={UserCheck} />
        <StatCard title="Team Head" value={loading ? '…' : (teamHeadMember?.name || 'Unassigned')} icon={UserCheck} />
      </div>

      <Card className="card-elevated border-0 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b-border/40">
                  <TableHead className="pl-5 font-medium text-xs uppercase tracking-wider w-10">#</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider">Name</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider">Contact</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider">Role</TableHead>
                  <TableHead className="font-medium text-xs uppercase tracking-wider">Joined</TableHead>
                  {isTeamHead && <TableHead className="font-medium text-xs uppercase tracking-wider pr-4 text-right">Performance</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <SkeletonRows /> : members.length === 0 ? (
                  <TableRow>
                  <TableCell colSpan={isTeamHead ? 6 : 5} className="py-16 text-center">
                      <Users className="h-7 w-7 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No members in this team yet.</p>
                    </TableCell>
                  </TableRow>
                ) : members.map((m, idx) => {
                  const isMemberHead = isHeadId(m.id);
                  return (
                  <TableRow
                    key={m.id}
                    className={`transition-colors border-b-border/30 ${isTeamHead ? 'cursor-pointer hover:bg-indigo-50/60' : 'hover:bg-muted/20'} ${isMemberHead ? 'bg-violet-50/50' : m.id === user?.id ? 'bg-indigo-50/40' : ''}`}
                    onClick={isTeamHead ? () => navigate(`/team/member/${m.id}`) : undefined}
                  >
                    <TableCell className="pl-5 py-3 text-sm text-muted-foreground font-mono">{idx + 1}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${m.id === user?.id ? 'bg-indigo-100' : 'bg-muted'}`}>
                          <span className={`text-xs font-semibold ${m.id === user?.id ? 'text-indigo-700' : 'text-muted-foreground'}`}>
                            {m.name?.charAt(0)?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">{m.name}</span>
                          {m.id === user?.id && <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 ml-1">You</span>}
                          {!m.is_active && <span className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded bg-destructive/10 text-destructive mt-0.5 inline-block ml-1">Inactive</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="text-sm text-foreground">{m.email}</div>
                      {m.phone && <div className="text-xs text-muted-foreground mt-0.5">{m.phone}</div>}
                    </TableCell>
                    <TableCell className="py-3">
                      {isMemberHead ? (
                        <Badge className="text-[10px] font-medium tracking-wider uppercase border-0 bg-violet-100 text-violet-700 gap-1">
                          <Crown className="h-3 w-3" /> Team Head
                        </Badge>
                      ) : (
                        <Badge className={`text-[10px] font-medium tracking-wider uppercase border-0 ${ROLE_BADGE[m.role] || 'bg-slate-100 text-slate-600'}`}>
                          {m.role?.replace('_', ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(m.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    {isTeamHead && (
                      <TableCell className="py-3 pr-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 group-hover:underline">
                          View <ChevronRight className="h-3 w-3" />
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamMembers;
