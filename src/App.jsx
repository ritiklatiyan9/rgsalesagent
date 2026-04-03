import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';

// Lazy load all pages
const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Leads = lazy(() => import('@/pages/Leads'));
const AddLead = lazy(() => import('@/pages/AddLead'));
const LeadAssignment = lazy(() => import('@/pages/LeadAssignment'));
const AssignmentHistory = lazy(() => import('@/pages/AssignmentHistory'));
const BulkLeads = lazy(() => import('@/pages/BulkLeads'));
const CallDashboard = lazy(() => import('@/pages/CallDashboard'));
const LogCall = lazy(() => import('@/pages/LogCall'));
const DailyCallEntry = lazy(() => import('@/pages/DailyCallEntry'));
const ScheduledCalls = lazy(() => import('@/pages/ScheduledCalls'));
const MissedFollowups = lazy(() => import('@/pages/MissedFollowups'));
const MissedCalls = lazy(() => import('@/pages/MissedCalls'));
const CallAnalytics = lazy(() => import('@/pages/CallAnalytics'));
const LeadCallHistory = lazy(() => import('@/pages/LeadCallHistory'));
const ColonyMaps = lazy(() => import('@/pages/ColonyMaps'));
const ColonyMapView = lazy(() => import('@/pages/ColonyMapView'));
const ManagePlots = lazy(() => import('@/pages/ManagePlots'));
const PlotDetail = lazy(() => import('@/pages/PlotDetail'));
const SharedPlot = lazy(() => import('@/pages/SharedPlot'));
const SharedMap = lazy(() => import('@/pages/SharedMap'));
const Reminders = lazy(() => import('@/pages/Reminders'));
const TeamMembers = lazy(() => import('@/pages/TeamMembers'));
const TeamManagement = lazy(() => import('@/pages/TeamManagement'));
const TeamPerformance = lazy(() => import('@/pages/TeamPerformance'));
const MemberPerformance = lazy(() => import('@/pages/MemberPerformance'));
const MemberCallAnalytics = lazy(() => import('@/pages/MemberCallAnalytics'));
const TeamAgentRegister = lazy(() => import('@/pages/TeamAgentRegister'));
const Profile = lazy(() => import('@/pages/Profile'));
const LeadsDialer = lazy(() => import('@/pages/LeadsDialer'));
const DialerPage = lazy(() => import('@/pages/DialerPage'));
const CallHistory = lazy(() => import('@/pages/CallHistory'));
const ContentShare = lazy(() => import('@/pages/ContentShare'));
const AllContacts = lazy(() => import('@/pages/AllContacts'));
const BulkImportContacts = lazy(() => import('@/pages/BulkImportContacts'));
const ShiftToCallQueue = lazy(() => import('@/pages/ShiftToCallQueue'));

const CallDetectorBridge = lazy(() =>
  import('@/components/CallDetectorBridge').catch((err) => {
    console.warn('[CallDetectorBridge] chunk load failed:', err);
    return { default: () => null };
  })
);

// Bookings
const PlotBookings = lazy(() => import('@/pages/PlotBookings'));
const BookingDetail = lazy(() => import('@/pages/BookingDetail'));

// Attendance
const MarkAttendance = lazy(() => import('@/pages/MarkAttendance'));
const MyAttendance = lazy(() => import('@/pages/MyAttendance'));

// Chat
const Chat = lazy(() => import('@/pages/Chat'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-[#f8fafc]">
    <div className="w-80 space-y-4 animate-pulse">
      <div className="h-8 bg-muted rounded-lg mx-auto w-40" />
      <div className="h-10 bg-muted rounded-xl" />
      <div className="h-10 bg-muted rounded-xl" />
      <div className="h-10 bg-muted rounded-xl" />
    </div>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/share/plot/:plotId" element={<SharedPlot />} />
            <Route path="/share/map/:mapId" element={<SharedMap />} />

            {/* Protected — AGENT & TEAM_HEAD */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['AGENT', 'TEAM_HEAD']}>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Dashboard */}
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />

              {/* Leads */}
              <Route path="leads" element={<Leads />} />
              <Route path="leads/add" element={<AddLead />} />
              <Route path="leads/bulk" element={<BulkLeads />} />
              <Route path="leads/assign" element={<LeadAssignment />} />
              <Route path="leads/assignment-history" element={<AssignmentHistory />} />

              {/* Call Management */}
              <Route path="calls" element={<CallDashboard />} />
              <Route path="calls/log" element={<LogCall />} />
              <Route path="calls/daily" element={<DailyCallEntry />} />
              <Route path="calls/scheduled" element={<ScheduledCalls />} />
              <Route path="calls/missed-followups" element={<MissedFollowups />} />
              <Route path="calls/missed" element={<MissedCalls />} />
              <Route path="calls/analytics" element={<CallAnalytics />} />
              <Route path="calls/dialer" element={<DialerPage />} />
              <Route path="calls/leads-dialer" element={<LeadsDialer />} />
              <Route path="calls/lead/:leadId" element={<LeadCallHistory />} />

              {/* Colony Maps */}
              <Route path="colony-maps" element={<ColonyMaps />} />
              <Route path="colony-maps/plots" element={<ManagePlots />} />
              <Route path="colony-maps/:id" element={<ColonyMapView />} />
              <Route path="colony-maps/:id/plots/:plotId" element={<PlotDetail />} />

              {/* Bookings */}
              <Route path="bookings" element={<PlotBookings />} />
              <Route path="bookings/:id" element={<BookingDetail />} />

              {/* Reminders */}
              <Route path="reminders" element={<Reminders />} />

              {/* Call History */}
              <Route path="calls/history" element={<CallHistory />} />

              {/* Team */}
              <Route path="team" element={<TeamMembers />} />
              <Route path="team/manage" element={<TeamManagement />} />
              <Route path="team/manage/register-agent" element={<TeamAgentRegister />} />
              <Route path="team/performance" element={<TeamPerformance />} />
              <Route path="team/member/:memberId" element={<MemberPerformance />} />
              <Route path="team/member/:memberId/calls" element={<MemberCallAnalytics />} />

              {/* Content Share */}
              <Route path="content-share" element={<ContentShare />} />

              {/* Profile */}
              <Route path="profile" element={<Profile />} />

              {/* Attendance */}
              <Route path="attendance" element={<MarkAttendance />} />
              <Route path="attendance/history" element={<MyAttendance />} />

              {/* Chat */}
              <Route path="chat" element={<Chat />} />

              {/* Contacts */}
              <Route path="all-contacts" element={<AllContacts />} />
              <Route path="all-contacts/bulk" element={<BulkImportContacts />} />
              <Route path="contacts/shift-to-call" element={<ShiftToCallQueue />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        <Suspense fallback={null}>
          <CallDetectorBridge />
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  );
}
