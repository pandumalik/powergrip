import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Project, Client, Employee, ProjectRole } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  FolderGit2,
  Plus,
  Search,
  Users,
  Building,
  Calendar,
  Tag,
  Edit3,
  X,
  Save,
  Trash2,
  UserPlus,
  AlertCircle,
} from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Create Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectType, setProjectType] = useState<any>('INFRA_MIGRATION');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [dateError, setDateError] = useState('');

  // Member Assignment State inside Edit Modal
  const [newMemberEmpId, setNewMemberEmpId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<ProjectRole>('DEVOPS_ENGINEER');
  const [editTagInput, setEditTagInput] = useState('');
  const [editDateError, setEditDateError] = useState('');

  const loadData = () => {
    api.getProjects().then(setProjects);
    api.getClients().then(setClients);
    api.getEmployees().then(setEmployees);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Comma-separated tag auto-handler for Create Modal
  const handleTagInputChange = (val: string) => {
    if (val.includes(',')) {
      const parts = val.split(',');
      const newTags = [...tags];
      for (let i = 0; i < parts.length - 1; i++) {
        const trimmed = parts[i].trim();
        if (trimmed && !newTags.includes(trimmed)) {
          newTags.push(trimmed);
        }
      }
      setTags(newTags);
      setTagInput(parts[parts.length - 1]);
    } else {
      setTagInput(val);
    }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = tagInput.trim();
      if (trimmed && !tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Comma-separated tag auto-handler for Edit Modal
  const handleEditTagInputChange = (val: string) => {
    if (!editingProject) return;
    if (val.includes(',')) {
      const parts = val.split(',');
      const currentTags = [...(editingProject.tags || [])];
      for (let i = 0; i < parts.length - 1; i++) {
        const trimmed = parts[i].trim();
        if (trimmed && !currentTags.includes(trimmed)) {
          currentTags.push(trimmed);
        }
      }
      setEditingProject({ ...editingProject, tags: currentTags });
      setEditTagInput(parts[parts.length - 1]);
    } else {
      setEditTagInput(val);
    }
  };

  const handleEditTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!editingProject) return;
      const trimmed = editTagInput.trim();
      const currentTags = editingProject.tags || [];
      if (trimmed && !currentTags.includes(trimmed)) {
        setEditingProject({ ...editingProject, tags: [...currentTags, trimmed] });
        setEditTagInput('');
      }
    }
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    if (!editingProject) return;
    const currentTags = editingProject.tags || [];
    setEditingProject({
      ...editingProject,
      tags: currentTags.filter((t) => t !== tagToRemove),
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    if (endDate && endDate < startDate) {
      setDateError('Target end date cannot be earlier than start date.');
      return;
    }

    // Flush any pending tag in input
    const finalTags = [...tags];
    const pendingTag = tagInput.trim();
    if (pendingTag && !finalTags.includes(pendingTag)) {
      finalTags.push(pendingTag);
    }

    await api.createProject({
      name,
      code,
      clientId: clientId || clients[0]?.id,
      projectType,
      startDate,
      endDate: endDate || undefined,
      description,
      tags: finalTags,
    });

    setIsCreateOpen(false);
    setName('');
    setCode('');
    setDescription('');
    setTags([]);
    setTagInput('');
    setDateError('');
    loadData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    if (editingProject.endDate && editingProject.endDate < editingProject.startDate) {
      setEditDateError('Target end date cannot be earlier than start date.');
      return;
    }

    // Flush any pending tag in input
    const finalTags = [...(editingProject.tags || [])];
    const pendingTag = editTagInput.trim();
    if (pendingTag && !finalTags.includes(pendingTag)) {
      finalTags.push(pendingTag);
    }

    await api.updateProject(editingProject.id, {
      ...editingProject,
      tags: finalTags,
    });
    setEditingProject(null);
    setEditDateError('');
    loadData();
  };

  const handleAddMemberToEditing = () => {
    if (!editingProject || !newMemberEmpId) return;
    const current = editingProject.assignedMembers || [];
    const updated = [
      ...current.filter((m) => m.employee_id !== newMemberEmpId),
      {
        employee_id: newMemberEmpId,
        role: newMemberRole,
        assigned_at: new Date().toISOString(),
        is_active: true,
      },
    ];
    setEditingProject({ ...editingProject, assignedMembers: updated });
    setNewMemberEmpId('');
  };

  const handleRemoveMemberFromEditing = (empId: string) => {
    if (!editingProject) return;
    const updated = (editingProject.assignedMembers || []).filter((m) => m.employee_id !== empId);
    setEditingProject({ ...editingProject, assignedMembers: updated });
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      (p.client?.name || '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-purple-400" />
            Projects
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tracking customer project deliverables and embedded DevOps squad rosters. Click any card to edit.
          </p>
        </div>

        <button
          onClick={() => {
            setDateError('');
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Initialize Project
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Search by project name, project code, or client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filtered.map((project) => (
          <div
            key={project.id}
            onClick={() => {
              setEditDateError('');
              setEditingProject({ ...project });
            }}
            className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col justify-between cursor-pointer group border border-slate-800 hover:border-purple-500/40 transition-all duration-200"
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-purple-500/30">
                      {project.code}
                    </span>
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {project.client?.name || 'Client Unlinked'}
                    </span>
                    <span className="text-[10px] text-purple-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                      <Edit3 className="w-3 h-3" /> Click to Edit
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1.5 group-hover:text-purple-300 transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{project.description || 'No description provided.'}</p>
                </div>
                <StatusBadge status={project.status} />
              </div>

              {/* Tags & Dates */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800 font-mono flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-400" />
                  {project.startDate} to {project.endDate || 'Ongoing'}
                </span>
                {project.tags && project.tags.length > 0 ? (
                  project.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1 font-mono"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {t}
                    </span>
                  ))
                ) : null}
              </div>

              {/* Embedded Members JSONB Roster */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-brand-400" />
                    Assigned Squad Roster
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    {project.assignedMembers?.length || 0} Staffed
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {project.assignedMembers && project.assignedMembers.length > 0 ? (
                    project.assignedMembers.map((member, idx) => {
                      const emp = employees.find((e) => e.id === member.employee_id);
                      return (
                        <div
                          key={idx}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2 text-xs"
                        >
                          <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-[10px]">
                            {emp ? emp.firstName[0] : 'U'}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-200">
                              {emp ? `${emp.firstName} ${emp.lastName}` : member.employee_id}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {member.role.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500 italic">No squad members assigned yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Type: {project.projectType.replace(/_/g, ' ')}</span>
              <span className="font-mono text-emerald-400">Zero-Join JSONB Roster</span>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-400" />
                Edit Project: {editingProject.name}
              </h3>
              <button
                onClick={() => setEditingProject(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Project Code</label>
                  <input
                    type="text"
                    required
                    value={editingProject.code}
                    onChange={(e) => setEditingProject({ ...editingProject, code: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={editingProject.status}
                    onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="INITIATION">INITIATION</option>
                    <option value="PLANNING">PLANNING</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="ON_HOLD">ON_HOLD</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Project Type</label>
                  <select
                    value={editingProject.projectType}
                    onChange={(e) => setEditingProject({ ...editingProject, projectType: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="INFRA_MIGRATION">Infrastructure Migration</option>
                    <option value="MANAGED_DEVOPS">Managed DevOps & SRE</option>
                    <option value="CLOUD_ARCHITECTURE">Cloud Architecture Setup</option>
                    <option value="SECURITY_AUDIT">Security Hardening & Audit</option>
                    <option value="INTERNAL_TOOLING">Internal Tooling</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Client Owner</label>
                  <select
                    value={editingProject.clientId}
                    onChange={(e) => setEditingProject({ ...editingProject, clientId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date Pickers with min validation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={editingProject.startDate}
                    onChange={(e) => {
                      setEditDateError('');
                      setEditingProject({ ...editingProject, startDate: e.target.value });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target End Date</label>
                  <input
                    type="date"
                    min={editingProject.startDate}
                    value={editingProject.endDate || ''}
                    onChange={(e) => {
                      setEditDateError('');
                      setEditingProject({ ...editingProject, endDate: e.target.value || undefined });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              {editDateError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editDateError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Project scope, objectives, SLA constraints..."
                  value={editingProject.description || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Comma-Separated Auto Tag Management (No Add button needed) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Project Tags</label>
                  <span className="text-[11px] text-slate-400">Type comma (<code className="text-purple-400">,</code>) or Enter to add</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Kubernetes, AWS, ISO27001 (auto-separated by comma)"
                  value={editTagInput}
                  onChange={(e) => handleEditTagInputChange(e.target.value)}
                  onKeyDown={handleEditTagInputKeyDown}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 mb-2"
                />

                <div className="flex flex-wrap gap-1.5 min-h-6">
                  {editingProject.tags && editingProject.tags.length > 0 ? (
                    editingProject.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 text-xs font-mono"
                      >
                        <Tag className="w-3 h-3" />
                        {t}
                        <button
                          type="button"
                          onClick={() => handleRemoveEditTag(t)}
                          className="hover:text-rose-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">No tags added yet. Type with commas above.</span>
                  )}
                </div>
              </div>

              {/* Member Roster Editor */}
              <div className="pt-3 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Staffed Squad Members ({editingProject.assignedMembers?.length || 0})
                </label>

                {/* Add Member Row */}
                <div className="flex gap-2 mb-3">
                  <select
                    value={newMemberEmpId}
                    onChange={(e) => setNewMemberEmpId(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Select Employee to Add...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.jobTitle})
                      </option>
                    ))}
                  </select>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as ProjectRole)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="LEAD_ARCHITECT">Lead Architect</option>
                    <option value="SENIOR_SRE">Senior SRE</option>
                    <option value="DEVOPS_ENGINEER">DevOps Engineer</option>
                    <option value="SECURITY_ANALYST">Security Analyst</option>
                    <option value="PROJECT_MANAGER">Project Manager</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddMemberToEditing}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>

                {/* Current Squad Chips */}
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {editingProject.assignedMembers?.map((m, idx) => {
                    const emp = employees.find((e) => e.id === m.employee_id);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">
                            {emp ? `${emp.firstName} ${emp.lastName}` : m.employee_id}
                          </span>
                          <span className="text-[10px] font-mono text-purple-400 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                            {m.role.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMemberFromEditing(m.employee_id)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
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

      {/* Create Project Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-purple-400" />
                Initialize New Engineering Project
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fintech Core Kubernetes Migration"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Project Code</label>
                  <input
                    type="text"
                    required
                    placeholder="PRJ-FINTECH-01"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Client Owner</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Project Type</label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="INFRA_MIGRATION">Infrastructure Migration</option>
                  <option value="MANAGED_DEVOPS">Managed DevOps & SRE</option>
                  <option value="CLOUD_ARCHITECTURE">Cloud Architecture Setup</option>
                  <option value="SECURITY_AUDIT">Security Hardening & Audit</option>
                </select>
              </div>

              {/* Date Selector Row with validation min */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setDateError('');
                      setStartDate(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target End Date (Optional)</label>
                  <input
                    type="date"
                    min={startDate}
                    value={endDate}
                    onChange={(e) => {
                      setDateError('');
                      setEndDate(e.target.value);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              {dateError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{dateError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Project scope, objectives, and deliverables..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Comma-Separated Auto Tag Input (No Add button needed) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Custom Tags</label>
                  <span className="text-[11px] text-slate-400">Type comma (<code className="text-purple-400">,</code>) or Enter to add</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. AWS, PCI-DSS, K8s (auto-separated by comma)"
                  value={tagInput}
                  onChange={(e) => handleTagInputChange(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 mb-2"
                />

                <div className="flex flex-wrap gap-1.5 min-h-6">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 text-xs font-mono"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg shadow-brand-600/20"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
