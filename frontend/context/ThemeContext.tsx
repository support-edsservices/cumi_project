'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export const FONT_FAMILY = 'Calibri';

export const FONT_SIZES = {
  micro: '0.6rem',
  tiny: '0.62rem',
  tinyPlus: '0.63rem',
  compact: '0.67rem',
  small: '0.68rem',
  smallPlus: '0.7rem',
  label: '0.72rem',
  bodySmall: '0.75rem',
  bodyCompact: '0.76rem',
  body: '0.8rem',
  bodyLarge: '0.83rem',
  subtitle: '0.9rem',
  brand: '0.93rem',
  heading: '0.975rem',
  sectionHeading: '1.25rem',
  metric: '1.35rem',
  metricLarge: '1.4rem',
  display: '1.5rem',
  chartLabel: '10px',
  chartLegend: '11px',
  chartTooltip: '12px',
  svgTiny: '8px',
  svgSmall: '9px',
  svgBody: '12px',
  svgLabel: '13px',
  svgMetric: '22px',
} as const;

interface ThemeCtx { theme: Theme; toggle: () => void; }
const ThemeContext = createContext<ThemeCtx>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  /* Read persisted preference once mounted */
  useEffect(() => {
    const saved = (localStorage.getItem('em-theme') as Theme | null) ?? 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);

    const root = document.documentElement;
    root.style.setProperty('--font-family', FONT_FAMILY);
    for (const [name, size] of Object.entries(FONT_SIZES)) {
      root.style.setProperty(`--font-size-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, size);
    }
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('em-theme', next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
