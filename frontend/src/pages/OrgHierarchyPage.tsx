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
  ChevronRight,
  Edit3,
  X,
  Save,
  Plus,
} from 'lucide-react';

export const OrgHierarchyPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const loadData = () => {
    api.getEmployees().then(setEmployees);
    api.getDepartments().then(setDepartments);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    await api.updateEmployee(editingEmployee.id, editingEmployee);
    setEditingEmployee(null);
    loadData();
  };

  const handleOffboard = async (id: string, name: string) => {
    if (window.confirm(`Initiate instant offboarding and access revocation for ${name}?`)) {
      await api.updateEmployee(id, { employmentStatus: 'TERMINATED' });
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
          Employees
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Visualizing reporting hierarchy tree powered by PostgreSQL 17 <code className="text-brand-400 font-mono">ltree</code> indexes. Click any employee card to edit.
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
          Staff Directory & Line Management
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employees.map((emp) => {
            const manager = employees.find((e) => e.id === emp.managerId);
            return (
              <div
                key={emp.id}
                onClick={() => setEditingEmployee({ ...emp })}
                className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col justify-between cursor-pointer group border border-slate-800 hover:border-blue-500/40 transition-all duration-200"
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
                          <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                            {emp.firstName} {emp.lastName}
                          </h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {emp.employeeNumber}
                          </span>
                          <span className="text-[10px] text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold flex items-center gap-0.5">
                            <Edit3 className="w-2.5 h-2.5" /> Edit
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
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOffboard(emp.id, `${emp.firstName} ${emp.lastName}`);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Offboard
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                Edit Employee: {editingEmployee.firstName} {editingEmployee.lastName}
              </h3>
              <button
                onClick={() => setEditingEmployee(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.firstName}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, firstName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.lastName}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, lastName: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  value={editingEmployee.jobTitle}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, jobTitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editingEmployee.email}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Employment Status</label>
                  <select
                    value={editingEmployee.employmentStatus}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, employmentStatus: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PROBATION">PROBATION</option>
                    <option value="ON_LEAVE">ON_LEAVE</option>
                    <option value="TERMINATED">TERMINATED</option>
                    <option value="RESIGNED">RESIGNED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                  <select
                    value={editingEmployee.departmentId || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, departmentId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Reports To (Manager)</label>
                  <select
                    value={editingEmployee.managerId || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, managerId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">None / Board</option>
                    {employees
                      .filter((e) => e.id !== editingEmployee.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.firstName} {m.lastName} ({m.jobTitle})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-600/20 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
