import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Employee, Department } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  Users,
  GitFork,
  Building,
  UserX,
  Mail,
  Shield,
  Layers,
  ChevronRight,
} from 'lucide-react';

export const OrgHierarchyPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const loadData = () => {
    api.getEmployees().then(setEmployees);
    api.getDepartments().then(setDepartments);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOffboard = async (id: string, name: string) => {
    if (window.confirm(`Initiate instant offboarding and access revocation for ${name}?`)) {
      await api.getAccessGrants().then((grants) => {
        const active = grants.filter((g) => g.employeeId === id && g.status === 'ACTIVE');
        active.forEach((g) => api.revokeAccess(g.id, 'Employee Terminated/Offboarded'));
      });
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          Organizational Hierarchy & Squad Structures
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Visualizing reporting hierarchy tree powered by PostgreSQL 17 <code className="text-brand-400 font-mono">ltree</code> indexes.
        </p>
      </div>

      {/* Departments Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {departments.map((dept) => {
          const count = employees.filter((e) => e.departmentId === dept.id).length;
          return (
            <div key={dept.id} className="glass-panel rounded-2xl p-4 border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Building className="w-4 h-4 text-emerald-400" />
                {dept.name}
              </div>
              <p className="text-2xl font-bold text-white mt-2">{count} Staff</p>
              <span className="text-[10px] font-mono text-slate-500 uppercase">{dept.code}</span>
            </div>
          );
        })}
      </div>

      {/* Employee Tree Cards */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <GitFork className="w-4 h-4 text-brand-400" />
          Reporting Chains & Line Management
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employees.map((emp) => {
            const manager = employees.find((e) => e.id === emp.managerId);
            return (
              <div
                key={emp.id}
                className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center font-bold text-brand-400">
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">
                            {emp.firstName} {emp.lastName}
                          </h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {emp.employeeNumber}
                          </span>
                        </div>
                        <p className="text-xs text-brand-400 font-medium">{emp.jobTitle}</p>
                      </div>
                    </div>
                    <StatusBadge status={emp.employmentStatus} />
                  </div>

                  {/* Hierarchy Path Badge */}
                  <div className="mt-4 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                    <span className="text-[10px] font-mono text-slate-500 block uppercase font-semibold mb-1">
                      Postgres ltree Path:
                    </span>
                    <span className="font-mono text-xs text-emerald-400 break-all">
                      {emp.hierarchyPath || emp.employeeNumber}
                    </span>
                  </div>

                  {/* Manager and Contact */}
                  <div className="mt-3 space-y-1 text-xs text-slate-400">
                    <p className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      {emp.email}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
                      Reports to: <span className="text-slate-300 font-semibold">{manager ? `${manager.firstName} ${manager.lastName}` : 'Board / Direct'}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Joined: {emp.joinDate}</span>
                  {emp.employmentStatus === 'ACTIVE' && (
                    <button
                      onClick={() => handleOffboard(emp.id, `${emp.firstName} ${emp.lastName}`)}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Offboard / Revoke All
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
