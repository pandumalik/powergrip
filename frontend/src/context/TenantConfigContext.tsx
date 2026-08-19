import React, { createContext, useContext, useEffect, useState } from 'react';

export interface TenantConfig {
  appName: string;
  tagline: string;
  version: string;
  company: {
    name: string;
    legalEntity: string;
    supportEmail: string;
    contactPhone: string;
    location: string;
    headquarters: string;
    website: string;
  };
  branding: {
    logoText: string;
    primaryColor: string; // e.g. '#22c55e'
    secondaryColor: string; // e.g. '#3b82f6'
    accentColor: string; // e.g. '#8b5cf6'
  };
  footer: {
    securityBadge: string;
    complianceText: string;
  };
}

export const defaultTenantConfig: TenantConfig = {
  appName: 'PowerGrip',
  tagline: 'Enterprise MSP & PAM Asset Matrix',
  version: '2.0.0',
  company: {
    name: 'PowerGrip Technologies Inc.',
    legalEntity: 'PowerGrip Global Corp.',
    supportEmail: 'ops@powergrip.internal',
    contactPhone: '+1 (800) 555-GRIP',
    location: 'Jakarta & Singapore',
    headquarters: 'Jakarta Selatan, Indonesia',
    website: 'https://powergrip.io',
  },
  branding: {
    logoText: 'PowerGrip',
    primaryColor: '#22c55e',
    secondaryColor: '#3b82f6',
    accentColor: '#8b5cf6',
  },
  footer: {
    securityBadge: 'PAM Zero-Trust Architecture',
    complianceText: 'Postgres 17 • Keycloak 26 • Vault CA',
  },
};

interface TenantConfigContextType {
  config: TenantConfig;
  updateConfig: (newConfig: Partial<TenantConfig>) => void;
  resetConfig: () => void;
  exportConfigJson: () => string;
  importConfigJson: (jsonString: string) => boolean;
}

const TenantConfigContext = createContext<TenantConfigContextType | undefined>(undefined);

export const TenantConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfigState] = useState<TenantConfig>(() => {
    try {
      const saved = localStorage.getItem('powergrip_tenant_config');
      if (saved) {
        return { ...defaultTenantConfig, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return defaultTenantConfig;
  });

  // Load from /app.config.json on initial mount if no local overrides
  useEffect(() => {
    fetch('/app.config.json')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('No config file');
      })
      .then((fileConfig) => {
        const saved = localStorage.getItem('powergrip_tenant_config');
        if (!saved) {
          setConfigState((prev) => ({ ...prev, ...fileConfig }));
        }
      })
      .catch(() => {
        // Use default configuration
      });
  }, []);

  // Inject dynamic CSS variables for brand colors
  useEffect(() => {
    const root = document.documentElement;
    if (config.branding?.primaryColor) {
      root.style.setProperty('--color-primary', config.branding.primaryColor);
    }
    if (config.branding?.secondaryColor) {
      root.style.setProperty('--color-secondary', config.branding.secondaryColor);
    }
    if (config.branding?.accentColor) {
      root.style.setProperty('--color-accent', config.branding.accentColor);
    }
    document.title = `${config.appName} | ${config.tagline}`;
  }, [config]);

  const updateConfig = (partial: Partial<TenantConfig>) => {
    setConfigState((prev) => {
      const updated = {
        ...prev,
        ...partial,
        company: { ...prev.company, ...(partial.company || {}) },
        branding: { ...prev.branding, ...(partial.branding || {}) },
        footer: { ...prev.footer, ...(partial.footer || {}) },
      };
      localStorage.setItem('powergrip_tenant_config', JSON.stringify(updated));
      return updated;
    });
  };

  const resetConfig = () => {
    localStorage.removeItem('powergrip_tenant_config');
    setConfigState(defaultTenantConfig);
  };

  const exportConfigJson = () => {
    return JSON.stringify(config, null, 2);
  };

  const importConfigJson = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      updateConfig(parsed);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <TenantConfigContext.Provider
      value={{ config, updateConfig, resetConfig, exportConfigJson, importConfigJson }}
    >
      {children}
    </TenantConfigContext.Provider>
  );
};

export const useTenantConfig = () => {
  const context = useContext(TenantConfigContext);
  if (!context) {
    throw new Error('useTenantConfig must be used within a TenantConfigProvider');
  }
  return context;
};
