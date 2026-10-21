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

function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length !== 6) return [34, 197, 94]; // fallback emerald
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function mixRgb(rgb1: [number, number, number], rgb2: [number, number, number], weight: number): [number, number, number] {
  return [
    Math.round(rgb1[0] * weight + rgb2[0] * (1 - weight)),
    Math.round(rgb1[1] * weight + rgb2[1] * (1 - weight)),
    Math.round(rgb1[2] * weight + rgb2[2] * (1 - weight)),
  ];
}

const PRESET_SHADES: Record<string, Record<string, string>> = {
  '#22c55e': {
    '50': '240 253 244',
    '100': '220 252 231',
    '200': '187 247 208',
    '300': '134 239 172',
    '400': '74 222 128',
    '500': '34 197 94',
    '600': '22 163 74',
    '700': '21 128 61',
    '800': '22 101 52',
    '900': '20 83 45',
  },
  '#2563eb': {
    '50': '239 246 255',
    '100': '219 234 254',
    '200': '191 219 254',
    '300': '147 197 253',
    '400': '96 165 250',
    '500': '37 99 235',
    '600': '29 78 216',
    '700': '30 64 175',
    '800': '30 58 138',
    '900': '23 37 84',
  },
  '#06b6d4': {
    '50': '236 254 255',
    '100': '207 250 254',
    '200': '165 243 252',
    '300': '103 232 249',
    '400': '34 211 238',
    '500': '6 182 212',
    '600': '8 145 178',
    '700': '14 116 144',
    '800': '21 94 117',
    '900': '22 78 99',
  },
  '#8b5cf6': {
    '50': '245 243 255',
    '100': '237 233 254',
    '200': '221 214 254',
    '300': '196 181 253',
    '400': '167 139 250',
    '500': '139 92 246',
    '600': '124 58 237',
    '700': '109 40 217',
    '800': '91 33 182',
    '900': '76 29 149',
  },
  '#f59e0b': {
    '50': '255 251 235',
    '100': '254 243 199',
    '200': '253 230 138',
    '300': '252 211 77',
    '400': '251 191 36',
    '500': '245 158 11',
    '600': '217 119 6',
    '700': '180 83 9',
    '800': '146 64 14',
    '900': '120 53 15',
  },
  '#f43f5e': {
    '50': '255 241 242',
    '100': '255 228 230',
    '200': '254 205 211',
    '300': '253 164 175',
    '400': '251 113 133',
    '500': '244 63 94',
    '600': '225 29 72',
    '700': '190 18 60',
    '800': '159 18 57',
    '900': '136 19 55',
  },
};

function generateBrandShades(primaryHex: string): Record<string, string> {
  const normHex = (primaryHex || '#22c55e').toLowerCase().trim();
  if (PRESET_SHADES[normHex]) {
    return PRESET_SHADES[normHex];
  }

  const baseRgb = hexToRgb(normHex);
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];

  const format = (rgb: [number, number, number]) => `${rgb[0]} ${rgb[1]} ${rgb[2]}`;

  return {
    '50': format(mixRgb(white, baseRgb, 0.95)),
    '100': format(mixRgb(white, baseRgb, 0.90)),
    '200': format(mixRgb(white, baseRgb, 0.75)),
    '300': format(mixRgb(white, baseRgb, 0.55)),
    '400': format(mixRgb(white, baseRgb, 0.25)),
    '500': format(baseRgb),
    '600': format(mixRgb(baseRgb, black, 0.85)),
    '700': format(mixRgb(baseRgb, black, 0.70)),
    '800': format(mixRgb(baseRgb, black, 0.50)),
    '900': format(mixRgb(baseRgb, black, 0.35)),
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

  // Inject dynamic CSS variables for brand colors into document root
  useEffect(() => {
    const root = document.documentElement;
    const primaryHex = config.branding?.primaryColor || '#22c55e';
    const shades = generateBrandShades(primaryHex);

    // Apply all Tailwind brand shade variables
    Object.entries(shades).forEach(([step, rgbStr]) => {
      root.style.setProperty(`--color-brand-${step}`, rgbStr);
    });

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
