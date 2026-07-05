"use client";

import { useEffect, useRef } from "react";

export function TaskSearchBar({
  projectName,
  defaultValue = "",
  className = "",
}: {
  projectName: string;
  defaultValue?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <form className={`search ${className}`.trim()} action="/tasks" method="get" role="search">
      <button className="search-submit" type="submit" aria-label="Search tasks">⌕</button>
      <input
        ref={inputRef}
        type="search"
        name="search"
        defaultValue={defaultValue}
        aria-label={`Search tasks in ${projectName}`}
        placeholder={`Search tasks in ${projectName}`}
      />
      <kbd>Ctrl K</kbd>
    </form>
  );
}
