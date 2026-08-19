import React, { useState } from 'react';
import { useTheme, Theme } from '@/context/ThemeContext';
import { useTenantConfig, TenantConfig } from '@/context/TenantConfigContext';
import {
  X,
  Settings,
  Moon,
  Sun,
  Laptop,
  Database,
  ShieldCheck,
  Server,
  Key,
  HardDrive,
  Radio,
  CheckCircle2,
  Building,
  Palette,
  FileCode,
  Download,
  Upload,
  RotateCcw,
  Save,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme } = useTheme();
  const { config, updateConfig, resetConfig, exportConfigJson, importConfigJson } =
    useTenantConfig();

  const [activeTab, setActiveTab] = useState<'theme' | 'company' | 'colors' | 'json' | 'stack'>('theme');
  const [formData, setFormData] = useState<TenantConfig>({ ...config });
  const [jsonInput, setJsonInput] = useState(exportConfigJson());
  const [jsonStatus, setJsonStatus] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      setFormData({ ...config });
      setJsonInput(exportConfigJson());
      setJsonStatus('');
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const themeOptions: { id: Theme; label: string; icon: any; description: string }[] = [
    {
      id: 'dark',
      label: 'Dark Mode',
      icon: Moon,
      description: 'Obsidian glassmorphism, high contrast for operations & NOC',
    },
    {
      id: 'light',
      label: 'Light Mode (Bone-White)',
      icon: Sun,
      description: 'Warm bone-white #F9F6EE aesthetic, soft warm sand cards and zero glare',
    },
    {
      id: 'system',
      label: 'System Preference',
      icon: Laptop,
      description: 'Automatically adapt to your operating system appearance',
    },
  ];

  const presetBrandColors = [
    { name: 'Emerald Power (Default)', primary: '#22c55e', secondary: '#3b82f6', accent: '#8b5cf6' },
    { name: 'Enterprise Blue', primary: '#2563eb', secondary: '#0ea5e9', accent: '#6366f1' },
    { name: 'Cyber Cyan', primary: '#06b6d4', secondary: '#3b82f6', accent: '#10b981' },
    { name: 'Royal Purple', primary: '#8b5cf6', secondary: '#ec4899', accent: '#3b82f6' },
    { name: 'Solar Amber', primary: '#f59e0b', secondary: '#ef4444', accent: '#10b981' },
    { name: 'Crimson Ops', primary: '#f43f5e', secondary: '#8b5cf6', accent: '#06b6d4' },
  ];

  const dockerServices = [
    { name: 'PostgreSQL 17 DB', port: '5432', icon: Database, status: 'Healthy', color: 'text-emerald-400' },
    { name: 'Keycloak 26 IAM', port: '8080', icon: ShieldCheck, status: 'Active (powergrip-realm)', color: 'text-blue-400' },
    { name: 'HashiCorp Vault SSH CA', port: '8200', icon: Key, status: 'Active', color: 'text-amber-400' },
    { name: 'Redis 7 Ephemeral Store', port: '6379', icon: Server, status: 'Connected', color: 'text-rose-400' },
    { name: 'NATS JetStream Bus', port: '4222', icon: Radio, status: 'Streaming', color: 'text-indigo-400' },
    { name: 'MinIO S3 Evidence Store', port: '9000', icon: HardDrive, status: 'Online', color: 'text-cyan-400' },
  ];

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig(formData);
    setJsonInput(JSON.stringify(formData, null, 2));
    setJsonStatus('Configuration saved successfully!');
    setTimeout(() => setJsonStatus(''), 3000);
  };

  const handleApplyColorPreset = (preset: { primary: string; secondary: string; accent: string }) => {
    const updated = {
      ...formData,
      branding: {
        ...formData.branding,
        primaryColor: preset.primary,
        secondaryColor: preset.secondary,
        accentColor: preset.accent,
      },
    };
    setFormData(updated);
    updateConfig(updated);
    setJsonInput(JSON.stringify(updated, null, 2));
  };

  const handleDownloadConfig = () => {
    const blob = new Blob([exportConfigJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app.config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = () => {
    const success = importConfigJson(jsonInput);
    if (success) {
      setFormData(JSON.parse(jsonInput));
      setJsonStatus('✅ Imported app.config.json successfully!');
    } else {
      setJsonStatus('❌ Invalid JSON syntax. Please check formatting.');
    }
    setTimeout(() => setJsonStatus(''), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {config.appName} Settings & Whitelabel Matrix
              </h3>
              <p className="text-xs text-slate-400">
                Customize branding, company details, theme, and export app.config.json.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/70 border border-slate-800 rounded-xl mb-5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('theme')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'theme' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" /> Appearance Theme
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'company' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building className="w-3.5 h-3.5" /> Company & Whitelabel
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('colors')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'colors' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" /> Brand Colors
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'json' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" /> app.config.json
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stack')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'stack' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Server className="w-3.5 h-3.5" /> Docker Services
          </button>
        </div>

        {/* Status Toast Notification */}
        {jsonStatus && (
          <div className="mb-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {jsonStatus}
          </div>
        )}

        {/* Tab 1: Theme */}
        {activeTab === 'theme' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" /> Choose Application Appearance
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all duration-150 relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-300'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-400" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">{opt.label}</span>
                      <span className="text-[10px] text-slate-400 block mt-1 leading-snug">{opt.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Company & Whitelabel Details */}
        {activeTab === 'company' && (
          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Application Name</label>
                <input
                  type="text"
                  required
                  value={formData.appName}
                  onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">App Tagline / Subtitle</label>
                <input
                  type="text"
                  required
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Company Legal Name</label>
                <input
                  type="text"
                  required
                  value={formData.company.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      company: { ...formData.company, name: e.target.value },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Support Email</label>
                <input
                  type="email"
                  required
                  value={formData.company.supportEmail}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      company: { ...formData.company, supportEmail: e.target.value },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={formData.company.contactPhone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      company: { ...formData.company, contactPhone: e.target.value },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Headquarters Location</label>
                <input
                  type="text"
                  value={formData.company.headquarters}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      company: { ...formData.company, headquarters: e.target.value },
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={resetConfig}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to Defaults
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" /> Save Company Details
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Brand Colors */}
        {activeTab === 'colors' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Customize the brand identity palette. The selected primary color immediately skins buttons, badges, highlights, and logos.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {presetBrandColors.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyColorPreset(preset)}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-600 text-left transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full shadow-md" style={{ backgroundColor: preset.primary }} />
                    <span className="w-4 h-4 rounded-full shadow-md" style={{ backgroundColor: preset.secondary }} />
                    <span className="w-3 h-3 rounded-full shadow-md" style={{ backgroundColor: preset.accent }} />
                  </div>
                  <span className="text-xs font-bold text-white group-hover:text-brand-400 transition-colors block">
                    {preset.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{preset.primary}</span>
                </button>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <label className="block text-xs font-semibold text-slate-300 mb-2">Custom HEX Primary Code</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.branding.primaryColor}
                  onChange={(e) => handleApplyColorPreset({ primary: e.target.value, secondary: '#3b82f6', accent: '#8b5cf6' })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={formData.branding.primaryColor}
                  onChange={(e) => handleApplyColorPreset({ primary: e.target.value, secondary: '#3b82f6', accent: '#8b5cf6' })}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: app.config.json Raw Editor */}
        {activeTab === 'json' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Deployable configuration file (<code className="text-emerald-400">app.config.json</code>) for multi-tenant installations.
              </p>
              <button
                type="button"
                onClick={handleDownloadConfig}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
              >
                <Download className="w-3.5 h-3.5" /> Download JSON
              </button>
            </div>

            <textarea
              rows={10}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-brand-500"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleImportJson}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-600/20 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> Apply & Save JSON
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Docker Container Stack */}
        {activeTab === 'stack' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-400" /> Docker Stack Services
            </h4>

            <div className="grid grid-cols-2 gap-2.5">
              {dockerServices.map((svc) => {
                const Icon = svc.icon;
                return (
                  <div
                    key={svc.name}
                    className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-2.5"
                  >
                    <div className="p-1.5 rounded-lg bg-slate-800 shrink-0">
                      <Icon className={`w-3.5 h-3.5 ${svc.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white truncate">{svc.name}</span>
                        <span className="text-[9px] font-mono text-slate-500">:{svc.port}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        {svc.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-800 mt-5">
          <span className="text-[10px] text-slate-500 font-mono">
            {config.appName} v{config.version} • {config.company.name}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
