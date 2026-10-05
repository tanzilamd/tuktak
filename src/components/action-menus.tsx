"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Native details keep keyboard semantics; one delegated listener covers mounted cards.
export function ActionMenus() {
  const path = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    function close(except?: HTMLDetailsElement) {
      document
        .querySelectorAll<HTMLDetailsElement>("details.post-menu[open]")
        .forEach((menu) => {
          if (menu !== except) menu.open = false;
        });
    }
    close();
    function toggle(event: Event) {
      const menu = event.target;
      if (
        menu instanceof HTMLDetailsElement &&
        menu.matches(".post-menu") &&
        menu.open
      )
        close(menu);
    }
    function click(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const menu =
        event.target.closest<HTMLDetailsElement>("details.post-menu");
      close(menu ?? undefined);
      if (event.target.closest(".menu-panel a, .menu-panel button")) close();
    }
    function key(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const menu = document.activeElement?.closest<HTMLDetailsElement>(
        "details.post-menu[open]",
      );
      close();
      menu?.querySelector<HTMLElement>("summary")?.focus();
    }
    function leave() {
      close();
    }
    document.addEventListener("toggle", toggle, true);
    document.addEventListener("click", click);
    document.addEventListener("keydown", key);
    window.addEventListener("pagehide", leave);
    return () => {
      close();
      document.removeEventListener("toggle", toggle, true);
      document.removeEventListener("click", click);
      document.removeEventListener("keydown", key);
      window.removeEventListener("pagehide", leave);
    };
  }, [path, search]);
  return null;
}
