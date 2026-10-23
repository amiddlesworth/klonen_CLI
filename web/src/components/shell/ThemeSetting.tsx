"use client";
import { useEffect, useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { applyThemePref, readThemePref, type ThemePref } from "./theme";

/** Theme choice for the settings page: System / Light / Dark (the same preference as the Me menu). */
export function ThemeSetting() {
  const [theme, setTheme] = useState<ThemePref>("system");
  useEffect(() => setTheme(readThemePref()), []);
  return (
    <SegmentedControl
      label="Theme"
      value={theme}
      onChange={(v) => {
        applyThemePref(v as ThemePref);
        setTheme(v as ThemePref);
      }}
      options={[
        { value: "system", label: "System" },
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ]}
    />
  );
}
