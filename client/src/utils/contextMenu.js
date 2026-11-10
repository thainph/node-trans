/*
 * Context menu: native Electron menu when available, otherwise a lightweight DOM menu
 * styled with the .menu / .menu-item classes.
 *
 *   const id = await showContextMenu(event, [
 *     { id: "rename", label: "Rename…" },
 *     { type: "separator" },
 *     { id: "delete", label: "Delete", disabled: false },
 *   ]);
 *
 * Resolves with the clicked item's id, or null when dismissed.
 */
export function showContextMenu(event, items) {
  event?.preventDefault?.();

  if (window.electronAPI?.showContextMenu) {
    return window.electronAPI.showContextMenu(items);
  }

  return new Promise((resolve) => {
    const menu = document.createElement("div");
    menu.className = "menu";
    menu.setAttribute("role", "menu");

    const close = (result) => {
      menu.remove();
      document.removeEventListener("mousedown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", onBlur);
      resolve(result);
    };
    const onOutside = (e) => { if (!menu.contains(e.target)) close(null); };
    const onKey = (e) => { if (e.key === "Escape") close(null); };
    const onBlur = () => close(null);

    for (const item of items) {
      if (item.type === "separator") {
        const sep = document.createElement("div");
        sep.className = "menu-separator";
        menu.appendChild(sep);
        continue;
      }
      const btn = document.createElement("button");
      btn.className = "menu-item";
      btn.setAttribute("role", "menuitem");
      btn.textContent = item.label;
      btn.disabled = !!item.disabled;
      btn.addEventListener("click", () => close(item.id));
      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    const { innerWidth, innerHeight } = window;
    const rect = menu.getBoundingClientRect();
    const x = Math.min(event?.clientX ?? 0, innerWidth - rect.width - 4);
    const y = Math.min(event?.clientY ?? 0, innerHeight - rect.height - 4);
    menu.style.left = `${Math.max(4, x)}px`;
    menu.style.top = `${Math.max(4, y)}px`;

    setTimeout(() => {
      document.addEventListener("mousedown", onOutside, true);
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("blur", onBlur);
    });
  });
}
