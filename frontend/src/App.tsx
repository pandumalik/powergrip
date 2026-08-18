import React, { useState } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { Sidebar, NavTab } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardPage } from '@/pages/DashboardPage';
import { ClientsPage } from '@/pages/ClientsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { InventoriesPage } from '@/pages/InventoriesPage';
import { AccessManagementPage } from '@/pages/AccessManagementPage';
import { OrgHierarchyPage } from '@/pages/OrgHierarchyPage';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-[#0B0F17] text-slate-100 selection:bg-brand-500 selection:text-white">
        {/* Sticky Left Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Navbar */}
          <Navbar />

          {/* Page View Body */}
          <main className="p-6 md:p-8 flex-1 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
            {activeTab === 'dashboard' && <DashboardPage setActiveTab={setActiveTab} />}
            {activeTab === 'clients' && <ClientsPage />}
            {activeTab === 'projects' && <ProjectsPage />}
            {activeTab === 'inventories' && <InventoriesPage />}
            {activeTab === 'access' && <AccessManagementPage />}
            {activeTab === 'employees' && <OrgHierarchyPage />}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
};
