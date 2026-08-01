import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { OfflineProvider } from '@/context/OfflineContext';
import { CallDrawerProvider } from '@/context/CallDrawerContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import OfflineIndicator from '@/components/OfflineIndicator';
import PermissionsModal from '@/components/PermissionsModal';

// Lazy load all pages
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Leads from '@/pages/Leads';
import CallDashboard from '@/pages/CallDashboard';
import AllContacts from '@/pages/AllContacts';
import ChatLayout from '@/pages/ChatLayout';
import MissedCalls from '@/pages/MissedCalls';
import DialerPage from '@/pages/DialerPage';
import CallHistory from '@/pages/CallHistory';
import ScheduledCalls from '@/pages/ScheduledCalls';

// Lazy load secondary/sub pages
const LeadsLayout = lazy(() => import('@/pages/LeadsLayout'));
const AddLead = lazy(() => import('@/pages/AddLead'));
const LeadAssignment = lazy(() => import('@/pages/LeadAssignment'));
const AssignmentHistory = lazy(() => import('@/pages/AssignmentHistory'));
const BulkLeads = lazy(() => import('@/pages/BulkLeads'));
const LogCall = lazy(() => import('@/pages/LogCall'));
const DailyCallEntry = lazy(() => import('@/pages/DailyCallEntry'));
// ScheduledCalls is eagerly loaded above
const MissedFollowups = lazy(() => import('@/pages/MissedFollowups'));
// MissedCalls is eagerly loaded above
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
// DialerPage is eagerly loaded above
// CallHistory is eagerly loaded above
const ContentShare = lazy(() => import('@/pages/ContentShare'));
const ContactsLayout = lazy(() => import('@/pages/ContactsLayout'));
const ShiftToCallQueue = lazy(() => import('@/pages/ShiftToCallQueue'));
const MatterLeads = lazy(() => import('@/pages/MatterLeads'));
const ChatList = lazy(() => import('@/pages/ChatList'));
const ChatRoom = lazy(() => import('@/pages/ChatRoom'));
const CallDrawer = lazy(() => import('@/components/CallDrawer'));

const CallDetectorBridge = lazy(() =>
  import('@/components/CallDetectorBridge').catch((err) => {
    console.warn('[CallDetectorBridge] chunk load failed:', err);
    return { default: () => null };
  })
);

// Bookings
const PlotBookings = lazy(() => import('@/pages/PlotBookings'));
const BookingDetail = lazy(() => import('@/pages/BookingDetail'));

// Tasks
const Tasks = lazy(() => import('@/pages/Tasks'));

// Sales (payments)
const Sales = lazy(() => import('@/pages/Sales'));

// Supervision Tasks (assigned by admin)
const SupervisionTasks = lazy(() => import('@/pages/SupervisionTasks'));

// Attendance
const MarkAttendance = lazy(() => import('@/pages/MarkAttendance'));
const MyAttendance = lazy(() => import('@/pages/MyAttendance'));


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
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  useEffect(() => {
    // Check if permissions have been requested before
    const permissionsRequested = localStorage.getItem('permissionsRequested');
    
    // Show permissions modal on first launch
    if (!permissionsRequested) {
      setShowPermissionsModal(true);
    }
  }, []);

  const handlePermissionsClose = () => {
    setShowPermissionsModal(false);
    localStorage.setItem('permissionsRequested', 'true');
  };

  return (
    <ErrorBoundary>
      {showPermissionsModal && (
        <PermissionsModal onClose={handlePermissionsClose} />
      )}
      <AuthProvider>
        <OfflineProvider>
        <CallDrawerProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/share/plot/:plotId" element={<SharedPlot />} />
            <Route path="/share/map/:mapId" element={<SharedMap />} />

            {/* Protected — AGENT, TEAM_HEAD & SUB_AGENT */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['AGENT', 'TEAM_HEAD', 'SUB_AGENT']}>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Dashboard */}
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />

              {/* Leads — shared layout keeps header+tabs frozen on navigation */}
              <Route path="leads" element={<LeadsLayout />}>
                <Route index element={<Leads />} />
                <Route path="add" element={<AddLead />} />
                <Route path="bulk" element={<BulkLeads />} />
                <Route path="assign" element={<LeadAssignment />} />
                <Route path="assignment-history" element={<AssignmentHistory />} />
              </Route>

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

              {/* Tasks */}
              <Route path="tasks" element={<Tasks />} />

              {/* Sales (payments tied to referral code) */}
              <Route path="sales" element={<Sales />} />

              {/* Supervision Tasks (admin-assigned) */}
              <Route path="supervision-tasks" element={<SupervisionTasks />} />

              {/* Reminders */}
              <Route path="reminders" element={<Reminders />} />

              {/* Call History */}
              <Route path="calls" element={<ContactsLayout />}>
                <Route path="history" element={<CallHistory />} />
              </Route>

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
              <Route path="chat" element={<ChatLayout />}>
                <Route index element={<ChatList />} />
                <Route path=":conversationId" element={<ChatRoom />} />
              </Route>

              {/* Contacts */}
              <Route path="all-contacts" element={<ContactsLayout />}>
                <Route index element={<AllContacts />} />
              </Route>
              <Route path="contacts" element={<ContactsLayout />}>
                <Route path="shift-to-call" element={<ShiftToCallQueue />} />
              </Route>

              {/* Matter Leads */}
              <Route path="matter-leads" element={<MatterLeads />} />
            </Route>

              {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        <Suspense fallback={null}>
          <CallDrawer />
          <CallDetectorBridge />
        </Suspense>
        <OfflineIndicator />
        </CallDrawerProvider>
        </OfflineProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
