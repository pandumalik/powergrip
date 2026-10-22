import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/services/api';
import { Employee, Department, Project, AccessGrant, InventoryItem, EmploymentStatus } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { BulkActionToolbar } from '@/components/common/BulkActionToolbar';
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
  FolderKanban,
  Server,
  Calendar,
  KeyRound,
  Trash2,
} from 'lucide-react';

export const OrgHierarchyPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>(() => api.getCachedEmployees());
  const [departments, setDepartments] = useState<Department[]>(() => api.getCachedDepartments());
  const [projects, setProjects] = useState<Project[]>(() => api.getCachedProjects());
  const [accessGrants, setAccessGrants] = useState<AccessGrant[]>(() => api.getCachedAccessGrants());
  const [inventories, setInventories] = useState<InventoryItem[]>(() => api.getCachedInventories());

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Details Modal State (Assigned Resources & Projects)
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState<Employee | null>(null);

  // Edit Modal State
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Offboarding Confirmation Modal State
  const [offboardTarget, setOffboardTarget] = useState<Employee | null>(null);
  const [isOffboarding, setIsOffboarding] = useState(false);
  const [offboardError, setOffboardError] = useState<string | null>(null);

  // Single Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadData = async () => {
    const [emps, depts, prjs, grants, invs] = await Promise.all([
      api.getEmployees(),
      api.getDepartments(),
      api.getProjects(),
      api.getAccessGrants(),
      api.getInventories(),
    ]);
    setEmployees(emps);
    setDepartments(depts);
    setProjects(prjs);
    setAccessGrants(grants);
    setInventories(invs);
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

  // Helper to color the status ring around employee initials
  const getStatusRingClass = (status: EmploymentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'ring-2 ring-emerald-500/80 text-emerald-400 bg-emerald-500/10 border-transparent';
      case 'PROBATION':
        return 'ring-2 ring-amber-500/80 text-amber-400 bg-amber-500/10 border-transparent';
      case 'ON_LEAVE':
        return 'ring-2 ring-blue-500/80 text-blue-400 bg-blue-500/10 border-transparent';
      case 'TERMINATED':
      case 'RESIGNED':
        return 'ring-2 ring-rose-500/80 text-rose-400 bg-rose-500/10 border-transparent';
      default:
        return 'ring-2 ring-slate-600 text-slate-400 bg-slate-800 border-slate-700';
    }
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
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === updated.id ? { ...emp, ...updated } : emp)),
    );
    if (selectedEmployeeDetails?.id === updated.id) {
      setSelectedEmployeeDetails(updated);
    }
    setEditingEmployee(null);
    await loadData();
  };

  const handleOffboardClick = (emp: Employee, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOffboardTarget(emp);
    setOffboardError(null);
  };

  const handleDeleteClick = (emp: Employee, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeleteTarget(emp);
    setDeleteError(null);
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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    const res = await api.deleteEmployee(deleteTarget.id);
    setIsDeleting(false);
    if (res.success) {
      setEmployees((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      if (selectedEmployeeDetails?.id === deleteTarget.id) {
        setSelectedEmployeeDetails(null);
      }
      setDeleteTarget(null);
      await loadData();
    } else {
      setDeleteError(res.error || 'Failed to delete employee record');
    }
  };

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(filteredEmployees.map((e) => e.id));
  };

  const handleDeselectAll = () => {
    setSelectedIds([]);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    setBulkDeleteError(null);
    const res = await api.deleteEmployees(selectedIds);
    setIsBulkDeleting(false);
    if (res.success) {
      setEmployees((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      await loadData();
    } else {
      setBulkDeleteError(res.errors?.join(', ') || 'Failed to delete selected employees');
      await loadData();
    }
  };

  // Helper to find assigned projects & access grants for the details modal
  const employeeProjects = useMemo(() => {
    if (!selectedEmployeeDetails) return [];
    return projects.filter(
      (p) =>
        p.projectManagerId === selectedEmployeeDetails.id ||
        (p.assignedMembers && p.assignedMembers.some((m) => m.employee_id === selectedEmployeeDetails.id || m.employeeId === selectedEmployeeDetails.id)),
    );
  }, [selectedEmployeeDetails, projects]);

  const employeeGrants = useMemo(() => {
    if (!selectedEmployeeDetails) return [];
    return accessGrants.filter((g) => g.employeeId === selectedEmployeeDetails.id);
  }, [selectedEmployeeDetails, accessGrants]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Employees & Staff Directory
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {employees.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Browse and manage organization staff, assigned projects, and privileged access grants. Click any row to inspect full profile and assigned resources.
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

      {/* Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedIds.length}
        totalCount={filteredEmployees.length}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onDeleteSelected={() => setIsBulkDeleteModalOpen(true)}
        isAllSelected={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
        resourceName="employees"
        deleteLabel={`Delete Selected (${selectedIds.length})`}
      />

      {/* Employee Directory Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredEmployees.map((emp) => emp.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5 min-w-[200px]">Name & ID</th>
                <th className="px-4 py-3.5 min-w-[200px]">Job Title & Hierarchy</th>
                <th className="px-4 py-3.5 min-w-[180px]">Email & Verification</th>
                <th className="px-4 py-3.5 min-w-[160px]">Department</th>
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
                  const displayName = formatDisplayName(emp.firstName, emp.lastName);
                  const isSelected = selectedIds.includes(emp.id);

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedEmployeeDetails(emp)}
                      className={`hover:bg-slate-900/60 cursor-pointer transition-colors group h-[68px] ${
                        isSelected ? 'bg-brand-500/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="w-10 px-4 py-3 text-center"
                        onClick={(e) => handleToggleSelect(emp.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-brand-500/30 cursor-pointer"
                        />
                      </td>

                      {/* Column 1: Name & ID with Status Ring on Avatar */}
                      <td className="px-4 py-3 min-w-[200px]">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all ${getStatusRingClass(emp.employmentStatus)}`}
                            title={`Status: ${emp.employmentStatus.replace(/_/g, ' ')}`}
                          >
                            {emp.firstName[0]}
                            {emp.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="font-bold text-white text-xs group-hover:text-blue-400 transition-colors truncate"
                                title={`${emp.firstName} ${emp.lastName}`}
                              >
                                {displayName}
                              </span>
                              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap shrink-0 leading-none">
                                {emp.employeeNumber}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                              Joined {emp.joinDate}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Job Title & Hierarchy */}
                      <td className="px-4 py-3 min-w-[200px]">
                        <p className="font-semibold text-slate-200 text-xs truncate max-w-[200px]" title={emp.jobTitle}>
                          {emp.jobTitle}
                        </p>
                        <p className="text-[10px] font-mono text-emerald-400 truncate max-w-[200px] mt-0.5" title={emp.hierarchyPath}>
                          {emp.hierarchyPath || emp.employeeNumber}
                        </p>
                      </td>

                      {/* Column 3: Email & Verification */}
                      <td className="px-4 py-3 min-w-[180px]">
                        <span className="text-slate-300 font-mono text-xs flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">{emp.email}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <ShieldCheck className="w-3 h-3 text-emerald-500/70 shrink-0" />
                          Corporate Identity
                        </span>
                      </td>

                      {/* Column 4: Department Only */}
                      <td className="px-4 py-3 min-w-[160px]">
                        <span className="inline-flex items-center gap-1.5 text-slate-300 text-xs font-medium truncate max-w-[150px]">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{dept?.name || 'Unassigned'}</span>
                        </span>
                      </td>

                      {/* Column 5: Actions (Offboard & Delete only) */}
                      <td className="px-4 py-3 text-right min-w-[100px]">
                        <div className="flex items-center justify-end gap-1.5">
                          {emp.employmentStatus === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={(e) => handleOffboardClick(emp, e)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
                              title="Offboard employee"
                            >
                              <UserX className="w-3 h-3" />
                              Offboard
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(emp, e)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs inline-flex items-center transition-colors"
                            title="Delete employee record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
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

      {/* Employee Details & Assigned Resources / Projects Modal */}
      {selectedEmployeeDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center font-bold text-base text-blue-400">
                  {selectedEmployeeDetails.firstName[0]}
                  {selectedEmployeeDetails.lastName[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">
                      {selectedEmployeeDetails.firstName} {selectedEmployeeDetails.lastName}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                      {selectedEmployeeDetails.employeeNumber}
                    </span>
                    <StatusBadge status={selectedEmployeeDetails.employmentStatus} />
                  </div>
                  <p className="text-xs text-blue-300 mt-0.5 font-medium">
                    {selectedEmployeeDetails.jobTitle} • {departments.find((d) => d.id === selectedEmployeeDetails.departmentId)?.name || 'General Department'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedEmployeeDetails(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] font-semibold uppercase">SSO Email Address</span>
                <p className="font-mono text-slate-200 truncate">{selectedEmployeeDetails.email}</p>
              </div>

              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] font-semibold uppercase">Hierarchy / Reporting Line</span>
                <p className="font-mono text-emerald-400 truncate">
                  {selectedEmployeeDetails.hierarchyPath || 'Direct / Top of Org'}
                </p>
              </div>

              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] font-semibold uppercase">Organization Join Date</span>
                <p className="text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  {selectedEmployeeDetails.joinDate}
                </p>
              </div>

              <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] font-semibold uppercase">Reports To (Manager)</span>
                <p className="text-slate-200">
                  {employees.find((e) => e.id === selectedEmployeeDetails.managerId)
                    ? `${employees.find((e) => e.id === selectedEmployeeDetails.managerId)?.firstName} ${employees.find((e) => e.id === selectedEmployeeDetails.managerId)?.lastName}`
                    : 'Board of Directors / Direct'}
                </p>
              </div>
            </div>

            {/* Section 1: Assigned Projects */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-brand-400" />
                  Assigned Client Projects ({employeeProjects.length})
                </h4>
              </div>

              {employeeProjects.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-500">
                  No active projects currently assigned to this employee.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {employeeProjects.map((prj) => (
                    <div
                      key={prj.id}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {prj.code}
                          </span>
                          <p className="text-xs font-bold text-white">{prj.name}</p>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Client: <span className="text-slate-300 font-semibold">{prj.client?.name || 'Enterprise'}</span> • {prj.projectManagerId === selectedEmployeeDetails.id ? 'Role: Project Manager' : 'Role: Team Member'}
                        </p>
                      </div>
                      <StatusBadge status={prj.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Accessible Infrastructure & PAM Grants */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  Privileged Access & Infrastructure Grants ({employeeGrants.length})
                </h4>
              </div>

              {employeeGrants.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-500">
                  No privileged access grants or asset permissions registered for this staff member.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {employeeGrants.map((grant) => {
                    const inv = grant.inventory || inventories.find((i) => i.id === grant.inventoryId);
                    return (
                      <div
                        key={grant.id}
                        className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <p className="text-xs font-bold text-white">{inv?.name || grant.inventory?.name || 'Inventory Asset'}</p>
                            <span className="text-[10px] font-mono text-slate-400">
                              ({inv?.assetTag || grant.inventory?.assetTag || 'TAG'})
                            </span>
                          </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span>Level: <span className="text-amber-300 font-semibold">{grant.accessLevel}</span></span>
                          <span>•</span>
                          <span>{grant.grantType === 'PERMANENT' ? 'Indefinite' : `TTL: ${grant.validUntil ? new Date(grant.validUntil).toLocaleTimeString() : 'Timed'}`}</span>
                          {grant.justification && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[180px] italic">"{grant.justification}"</span>
                            </>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={grant.status} />
                    </div>
                  );
                })}
              </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const emp = selectedEmployeeDetails;
                  setSelectedEmployeeDetails(null);
                  setEditingEmployee({ ...emp });
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Profile
              </button>

              <div className="flex items-center gap-2">
                {selectedEmployeeDetails.employmentStatus === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => {
                      const emp = selectedEmployeeDetails;
                      setSelectedEmployeeDetails(null);
                      handleOffboardClick(emp);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Offboard Staff
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedEmployeeDetails(null)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-600/20"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Offboarding Confirmation Modal */}
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

      {/* Single Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Employee Record"
        message="Are you sure you want to permanently delete this employee from the directory?"
        itemName={deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}` : undefined}
        itemTag={deleteTarget?.employeeNumber}
        itemDetails={
          deleteTarget
            ? [
                { label: 'Job Title', value: deleteTarget.jobTitle },
                { label: 'Email', value: deleteTarget.email },
                { label: 'Department', value: departments.find((d) => d.id === deleteTarget.departmentId)?.name || 'N/A' },
              ]
            : []
        }
        confirmLabel="Delete Employee"
        isLoading={isDeleting}
        errorMessage={deleteError}
        variant="danger"
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => {
          if (!isBulkDeleting) {
            setIsBulkDeleteModalOpen(false);
            setBulkDeleteError(null);
          }
        }}
        onConfirm={handleConfirmBulkDelete}
        title="Delete Selected Employees"
        message={`Are you sure you want to permanently delete ${selectedIds.length} selected employee record(s)? This will cascade or fail if active access grants or managed projects exist.`}
        confirmLabel={`Delete ${selectedIds.length} Employees`}
        isLoading={isBulkDeleting}
        errorMessage={bulkDeleteError}
        variant="danger"
      />
    </div>
  );
};
