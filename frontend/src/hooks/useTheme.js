import { useCallback, useEffect, useState } from "react";

const THEME_KEY = "theme";

function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  return savedTheme === "light" ? "light" : "dark";
}

export default function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === "dark";

    root.classList.toggle("dark", isDark);
    root.style.colorScheme = isDark ? "dark" : "light";
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return {
    theme,
    darkMode: theme === "dark",
    setTheme,
    toggleTheme,
  };
}
