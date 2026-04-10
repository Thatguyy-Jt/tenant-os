import { useState, useRef, useEffect } from "react";
import { Palette, Check } from "lucide-react";
import { useTheme, type ThemeOption } from "@/contexts/ThemeContext";

export function ThemePicker() {
  const { theme, setTheme, themeOptions } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const active = themeOptions.find((t) => t.id === theme);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Choose theme"
        title="Choose theme"
      >
        <span
          className="h-3 w-3 rounded-full ring-1 ring-border/50"
          style={{ backgroundColor: active?.primaryColor }}
        />
        <Palette size={13} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-xl">
          <div className="border-b border-border/40 px-3 py-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              App Theme
            </p>
          </div>
          <div className="p-1.5 space-y-0.5">
            {themeOptions.map((opt: ThemeOption) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setTheme(opt.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary/60"
              >
                <span
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ring-2 ring-border/40"
                  style={{ backgroundColor: opt.bgColor }}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ backgroundColor: opt.primaryColor }}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground leading-tight">{opt.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{opt.description}</p>
                </div>
                {theme === opt.id && (
                  <Check size={14} className="flex-shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
