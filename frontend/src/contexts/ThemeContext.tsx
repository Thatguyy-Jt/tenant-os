import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeId = "midnight-teal" | "ocean-blue" | "royal-purple" | "ember" | "arctic-light";

export type ThemeOption = {
  id: ThemeId;
  label: string;
  primaryColor: string;
  bgColor: string;
  description: string;
};

export const THEMES: ThemeOption[] = [
  {
    id: "midnight-teal",
    label: "Midnight Teal",
    primaryColor: "#2dd4bf",
    bgColor: "#0d1117",
    description: "Dark shell with teal accents",
  },
  {
    id: "ocean-blue",
    label: "Ocean Blue",
    primaryColor: "#3b82f6",
    bgColor: "#0a0f1a",
    description: "Deep dark with electric blue",
  },
  {
    id: "royal-purple",
    label: "Royal Purple",
    primaryColor: "#a855f7",
    bgColor: "#0e0a18",
    description: "Dark shell with violet accents",
  },
  {
    id: "ember",
    label: "Ember",
    primaryColor: "#f97316",
    bgColor: "#130b06",
    description: "Dark shell with warm orange glow",
  },
  {
    id: "arctic-light",
    label: "Arctic Light",
    primaryColor: "#2563eb",
    bgColor: "#f8fafc",
    description: "Clean light theme with blue accents",
  },
];

const STORAGE_KEY = "tenantos_theme";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  themeOptions: ThemeOption[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as ThemeId) ?? "midnight-teal";
  });

  const applyTheme = useCallback((id: ThemeId) => {
    document.documentElement.setAttribute("data-theme", id);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const setTheme = useCallback(
    (id: ThemeId) => {
      setThemeState(id);
      localStorage.setItem(STORAGE_KEY, id);
      applyTheme(id);
    },
    [applyTheme]
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themeOptions: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
