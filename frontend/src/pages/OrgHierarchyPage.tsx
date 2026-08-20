import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import { Employee, Department } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  UserX,
  Mail,
  Edit3,
  X,
  Save,
  Building,
  Filter,
  ShieldCheck,
} from 'lucide-react';

export const OrgHierarchyPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Edit Modal State
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Offboarding Confirmation Modal State
  const [offboardTarget, setOffboardTarget] = useState<Employee | null>(null);
  const [isOffboarding, setIsOffboarding] = useState(false);
  const [offboardError, setOffboardError] = useState<string | null>(null);

  const loadData = async () => {
    const [emps, depts] = await Promise.all([api.getEmployees(), api.getDepartments()]);
    setEmployees(emps);
    setDepartments(depts);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format display name: if full name > 20 characters, use firstName only
  const formatDisplayName = (firstName: string, lastName: string) => {
    const full = `${firstName} ${lastName}`.trim();
    if (full.length > 20) {
      return firstName;
    }
    return full;
  };

  // Filter employees based on search, department, and status
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      let match = true;
      if (departmentFilter !== 'ALL') {
        match = match && emp.departmentId === departmentFilter;
      }
      if (statusFilter !== 'ALL') {
        match = match && emp.employmentStatus === statusFilter;
      }
      if (search) {
        const s = search.toLowerCase();
        const dept = departments.find((d) => d.id === emp.departmentId);
        match =
          match &&
          (emp.firstName.toLowerCase().includes(s) ||
            emp.lastName.toLowerCase().includes(s) ||
            emp.employeeNumber.toLowerCase().includes(s) ||
            emp.email.toLowerCase().includes(s) ||
            emp.jobTitle.toLowerCase().includes(s) ||
            (dept?.name || '').toLowerCase().includes(s));
      }
      return match;
    });
  }, [employees, departments, search, departmentFilter, statusFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, departmentFilter, statusFilter]);

  // Pagination calculation
  const totalItems = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + pageSize);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    const updated = await api.updateEmployee(editingEmployee.id, editingEmployee);
    // Instant UI state update
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === updated.id ? { ...emp, ...updated } : emp)),
    );
    setEditingEmployee(null);
    await loadData();
  };

  const handleOffboardClick = (emp: Employee, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOffboardTarget(emp);
    setOffboardError(null);
  };

  const handleConfirmOffboard = async () => {
    if (!offboardTarget) return;
    setIsOffboarding(true);
    setOffboardError(null);
    try {
      const updated = await api.offboardEmployee(offboardTarget.id);
      setEmployees((prev) =>
        prev.map((emp) => (emp.id === offboardTarget.id ? { ...emp, ...updated } : emp)),
      );
      await api.getAccessGrants().then((grants) => {
        const active = grants.filter((g) => g.employeeId === offboardTarget.id && g.status === 'ACTIVE');
        active.forEach((g) => api.revokeAccess(g.id, 'Employee Terminated/Offboarded'));
      });
      setIsOffboarding(false);
      setOffboardTarget(null);
      await loadData();
    } catch (err: any) {
      setIsOffboarding(false);
      setOffboardError(err.message || 'Failed to offboard employee');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Employees & Staff Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Browse and manage all {employees.length} organization staff. Click any row to edit details.
          </p>
        </div>
      </div>

      {/* Departments Overview Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {departments.map((dept) => {
          const count = employees.filter((e) => e.departmentId === dept.id).length;
          return (
            <div
              key={dept.id}
              onClick={() => setDepartmentFilter(departmentFilter === dept.id ? 'ALL' : dept.id)}
              className={`glass-panel p-3.5 rounded-xl border transition-all cursor-pointer ${
                departmentFilter === dept.id
                  ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 truncate">{dept.name}</span>
                <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-white">{count}</span>
                <span className="text-[10px] font-mono text-slate-500">{dept.code}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="glass-panel p-3.5 rounded-2xl flex flex-col md:flex-row gap-3 border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search by name, employee ID (EMP-...), email, or job title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl px-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-transparent text-slate-300 text-xs py-2 focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PROBATION">Probation</option>
            <option value="ON_LEAVE">On Leave</option>
            <option value="TERMINATED">Terminated</option>
            <option value="RESIGNED">Resigned</option>
          </select>
        </div>
      </div>

      {/* Consistent 2-Line Employee List Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5 min-w-[220px]">Name & ID</th>
                <th className="px-4 py-3.5 min-w-[220px]">Job Title & Hierarchy</th>
                <th className="px-4 py-3.5 min-w-[200px]">Email & Verification</th>
                <th className="px-4 py-3.5 min-w-[180px]">Department & Manager</th>
                <th className="px-4 py-3.5 min-w-[120px]">Status</th>
                <th className="px-4 py-3.5 text-right min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    No employees matching the search criteria.
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp) => {
                  const dept = departments.find((d) => d.id === emp.departmentId);
                  const manager = employees.find((e) => e.id === emp.managerId);
                  const displayName = formatDisplayName(emp.firstName, emp.lastName);
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => setEditingEmployee({ ...emp })}
                      className="hover:bg-slate-900/60 cursor-pointer transition-colors group h-[68px]"
                    >
                      {/* Column 1: Name & ID (Fixed 2 lines) */}
                      <td className="px-5 py-3 min-w-[220px]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-brand-400 shrink-0 group-hover:border-blue-500/40 transition-colors">
                            {emp.firstName[0]}
                            {emp.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            {/* Line 1 */}
                            <div className="flex items-center gap-2">
                              <span
                                className="font-bold text-white text-xs group-hover:text-blue-400 transition-colors truncate"
                                title={`${emp.firstName} ${emp.lastName}`}
                              >
                                {displayName}
                              </span>
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap shrink-0 leading-none">
                                {emp.employeeNumber}
                              </span>
                            </div>
                            {/* Line 2 */}
                            <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                              Joined {emp.joinDate}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Job Title & Hierarchy (Fixed 2 lines) */}
                      <td className="px-4 py-3 min-w-[220px]">
                        {/* Line 1 */}
                        <p className="font-semibold text-slate-200 text-xs truncate max-w-[210px]" title={emp.jobTitle}>
                          {emp.jobTitle}
                        </p>
                        {/* Line 2 */}
                        <p className="text-[10px] font-mono text-emerald-400 truncate max-w-[210px] mt-0.5" title={emp.hierarchyPath}>
                          {emp.hierarchyPath || emp.employeeNumber}
                        </p>
                      </td>

                      {/* Column 3: Email & Verification (Fixed 2 lines) */}
                      <td className="px-4 py-3 min-w-[200px]">
                        {/* Line 1 */}
                        <span className="text-slate-300 font-mono text-xs flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{emp.email}</span>
                        </span>
                        {/* Line 2 */}
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <ShieldCheck className="w-3 h-3 text-emerald-500/70 shrink-0" />
                          Corporate SSO Identity
                        </span>
                      </td>

                      {/* Column 4: Department & Manager (Fixed 2 lines) */}
                      <td className="px-4 py-3 min-w-[180px]">
                        {/* Line 1 */}
                        <span className="inline-flex items-center gap-1 text-slate-300 text-xs truncate max-w-[170px]">
                          <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{dept?.name || 'Unassigned'}</span>
                        </span>
                        {/* Line 2 */}
                        <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                          {manager ? `Reports to: ${manager.firstName} ${manager.lastName}` : 'Reports to: Board / Direct'}
                        </span>
                      </td>

                      {/* Column 5: Status (Fixed 2 lines) */}
                      <td className="px-4 py-3 min-w-[120px]">
                        {/* Line 1 */}
                        <div>
                          <StatusBadge status={emp.employmentStatus} />
                        </div>
                        {/* Line 2 */}
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Full-Time Staff
                        </span>
                      </td>

                      {/* Column 6: Actions (Offboard only, click row to edit) */}
                      <td className="px-4 py-3 text-right min-w-[100px]">
                        {emp.employmentStatus === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={(e) => handleOffboardClick(emp, e)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium inline-flex items-center gap-1 transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            Offboard
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">Offboarded</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer (10 items per page) */}
        <div className="px-5 py-3 bg-slate-900/60 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-white">{totalItems === 0 ? 0 : startIndex + 1}</span> to{' '}
            <span className="font-semibold text-white">{Math.min(startIndex + pageSize, totalItems)}</span> of{' '}
            <span className="font-semibold text-white">{totalItems}</span> employees
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((pageNum, idx, arr) => (
                <React.Fragment key={pageNum}>
                  {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                    <span className="px-1 text-slate-600">...</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      currentPage === pageNum
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                </React.Fragment>
              ))}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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

      {/* Reusable Enterprise Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!offboardTarget}
        onClose={() => {
          if (!isOffboarding) {
            setOffboardTarget(null);
            setOffboardError(null);
          }
        }}
        onConfirm={handleConfirmOffboard}
        title="Initiate Employee Offboarding"
        message="Are you sure you want to offboard this staff member? All active privileged access grants and session keys will be instantly revoked."
        itemName={offboardTarget ? `${offboardTarget.firstName} ${offboardTarget.lastName}` : undefined}
        itemTag={offboardTarget?.employeeNumber}
        itemDetails={
          offboardTarget
            ? [
                { label: 'Job Title', value: offboardTarget.jobTitle },
                { label: 'Email', value: offboardTarget.email },
                { label: 'Status', value: offboardTarget.employmentStatus },
                { label: 'Hierarchy', value: offboardTarget.hierarchyPath || 'Direct' },
              ]
            : []
        }
        confirmLabel="Confirm Offboard"
        cancelLabel="Keep Active"
        isLoading={isOffboarding}
        errorMessage={offboardError}
        variant="warning"
      />
    </div>
  );
};
