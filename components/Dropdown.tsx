"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * Slick single-select dropdown replacing native <select>: dark popover,
 * check-marked selection, outside-click + Escape to close, arrow-key nav.
 */
export default function Dropdown({
  label,
  value,
  options,
  onChange,
  wide = false,
}: {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  useEffect(() => {
    if (open) {
      const idx = Math.max(
        0,
        options.findIndex((o) => o.value === value),
      );
      setFocus(idx);
      listRef.current
        ?.querySelector(`[data-idx="${idx}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [open, options, value]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border bg-coal px-3.5 py-2.5 text-sm outline-none transition",
          open ? "border-brand" : "border-line hover:border-muted",
          wide && "w-full",
        )}
      >
        <span className={cn("truncate", selected ? "text-white" : "text-muted")}>
          {selected ? selected.label : label}
        </span>
        <ChevronDown
          size={15}
          className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="animate-rise absolute z-50 mt-1.5 max-h-64 w-full min-w-52 overflow-y-auto rounded-xl border border-line bg-coal p-1 shadow-2xl shadow-black/60"
        >
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted">No options</p>
          )}
          {options.map((o, i) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                data-idx={i}
                onClick={() => pick(o.value)}
                onMouseEnter={() => setFocus(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                  i === focus ? "bg-line/70" : "",
                  active ? "font-semibold text-white" : "text-muted hover:text-white",
                )}
              >
                <span className="truncate">{o.label}</span>
                {active && <Check size={15} className="shrink-0 text-brand" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
