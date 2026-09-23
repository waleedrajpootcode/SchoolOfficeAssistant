import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LoginPage } from './pages/LoginPage.js';
import { Dashboard } from './pages/Dashboard.js';
import { ClassesPage } from './pages/ClassesPage.js';
import { StudentsPage } from './pages/StudentsPage.js';
import { TeachersPage } from './pages/TeachersPage.js';
import { AssignmentsPage } from './pages/AssignmentsPage.js';
import { MyClassesPage } from './pages/MyClassesPage.js';
import { AttendancePage } from './pages/AttendancePage.js';
import { FeesPage } from './pages/FeesPage.js';
import { AppShell as Layout } from './components/AppShell.js';
import { navigate, useRoute } from './router.js';
import { api } from './api/client.js';
import { SettingsPage } from './pages/SettingsPage.js';

function AdminSetupGate() {
  const [loading, setLoading] = useState(true);
  const [setupCompleted, setSetupCompleted] = useState(false);

  useEffect(() => {
    void loadSetupStatus();
  }, []);

  async function loadSetupStatus() {
    const result = await api.get<{
      setupCompleted: boolean;
    }>('/settings');

    if (result.success && result.data) {
      setSetupCompleted(result.data.setupCompleted);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <p>Checking school setup...</p>
      </div>
    );
  }

  if (!setupCompleted) {
    return (
      <SettingsPage
        onSetupComplete={() => {
          setSetupCompleted(true);
          window.location.hash = '#/dashboard';
        }}
      />
    );
  }

  return <AppShellRoutes isAdmin />;
}

function AppShellRoutes({ isAdmin }: { isAdmin: boolean }) {
  const { route } = useRoute();

  switch (route) {
    case 'classes':
      return <ClassesPage />;
    case 'students':
      return <StudentsPage />;
    case 'teachers':
      return isAdmin ? <TeachersPage /> : <Dashboard />;
    case 'assignments':
      return <AssignmentsPage />;
    case 'my-classes':
      return <MyClassesPage />;
    case 'attendance':
      return <AttendancePage />;
    case 'fees':
      return isAdmin ? <FeesPage /> : <Dashboard />;
    case 'settings':
      return isAdmin ? <SettingsPage /> : <Dashboard />;
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
      {user.role === 'admin' ? (
        <AdminSetupGate />
      ) : (
        <AppShellRoutes isAdmin={false} />
      )}
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