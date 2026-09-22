import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LoginPage } from './pages/LoginPage.js';
import { Dashboard } from './pages/Dashboard.js';
import { ClassesPage } from './pages/ClassesPage.js';
import { StudentsPage } from './pages/StudentsPage.js';
import { AssignmentsPage } from './pages/AssignmentsPage.js';
import { MyClassesPage } from './pages/MyClassesPage.js';
import { AttendancePage } from './pages/AttendancePage.js';
import { FeesPage } from './pages/FeesPage.js';
import { AppShell as Layout } from './components/AppShell.js';
import { useRoute } from './router.js';

function AppShellRoutes({ isAdmin }: { isAdmin: boolean }) {
  const { route } = useRoute();

  switch (route) {
    case 'classes':
      return <ClassesPage />;
    case 'students':
      return <StudentsPage />;
    case 'assignments':
      return <AssignmentsPage />;
    case 'my-classes':
      return <MyClassesPage />;
    case 'attendance':
      return <AttendancePage />;
      case 'fees':
  return isAdmin ? <FeesPage /> : <Dashboard />;
      case 'dashboard':
    default:
      return <Dashboard />;
  }
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: '#888', fontSize: '1rem' }}>Loading…</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <Layout>
      <AppShellRoutes isAdmin={user.role === 'admin'} />
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}