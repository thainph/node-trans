# Node Trans — Design System (macOS 26 "Liquid Glass")

Source of truth for UI work in `client/src/`. Style: **Liquid Glass** (macOS Tahoe) — floating translucent chrome over an opaque content layer, capsule controls, concentric rounded corners, system typography and colors. Applies to macOS, Windows and Linux; macOS gets extra native chrome (vibrancy behind the sidebar, inset traffic lights).

## Principles
- **Glass is for chrome only**: sidebar panel, toolbar capsules, floating bottom bar, sheets, menus, toasts, overlay. **Content (transcript) stays opaque** for legibility and GPU cost. Never put glass on glass.
- Full-bleed window: content runs edge to edge; the toolbar and bottom bar float over it. No centered `max-w-*` page container (the transcript column itself is capped at 760px for reading).
- One accent color (the OS accent, via `--accent`). Status colors only for status (red = recording/destructive, orange = paused, green = OK).
- Icons: `lucide-react`, `size={16}` (toolbar) or `14` (inline), `strokeWidth={1.75}`, monochrome. Never emoji as icons.
- Every icon-only button has `aria-label` and a `title` (add the shortcut via `shortcutLabel(id)` when one exists).
- Every new UI string goes into `i18n/locales.js` in **both** `en` and `vi`.
- CSS glass approximates Liquid Glass (blur + saturation + specular top edge + soft shadow). True lensing/refraction is AppKit-only and not available in Electron.

## Tokens (`style.css`) — use these, never raw hex / `gray-*` / `indigo-*`
| Utility | Use |
|---|---|
| `bg-window` / `bg-content` / `bg-grouped` | Window backdrop (sidebar column), opaque content, grouped form boxes |
| `bg-control` / `bg-fill` / `bg-fill-strong` | Control background, hover fill, pressed/track fill |
| `text-label` / `text-label-2` / `text-label-3` | Primary, secondary, tertiary/placeholder text |
| `border-separator` / `border-control-border` | Hairlines, control outlines |
| `bg-accent` / `text-accent` / `text-accent-text` | Accent fill / tinted text / text on accent |
| `text-sys-red` `bg-sys-red` … `sys-orange` `sys-yellow` `sys-green` | Status only |
| `speaker-0..7` classes → `var(--speaker-color)` | Speaker dot + name color |
| CSS vars `--glass`, `--glass-strong`, `--glass-tint`, `--glass-highlight`, `--shadow-glass`, `--shadow-popover` | Glass material (use the classes below instead of raw vars) |
| CSS vars `--radius-panel` 14, `--radius-row` 10, `--radius-sheet` 22 | Concentric radii |

Light/dark: tokens switch automatically on `[data-theme]`; avoid `dark:` variants unless a token is missing.

## Typography
System font stack (SF Pro on macOS). Body **13px**; secondary 11–12px; section header 11px semibold `text-label-2` (`.section-header`); toolbar title **15px semibold** with 11px subtitle; sheet/pane title 15px semibold; empty-state title 15px semibold. Ticking numbers: `font-mono tabular-nums`.

## Shape & spacing
4px grid. Capsule controls: buttons 28px (`.btn`), 32px (`.btn-lg`), 36px (toolbar record button `h-9`), icon buttons 32px round, fields/selects 28px capsules, segmented 28px track. Radii are concentric: window (system) → sidebar panel 14px inset 8px → rows 10px; sheets 22px; menus 14px with 8px items; floating bottom bar 22px. Hairline separators only inside panels.

## Component classes
| Class | Element |
|---|---|
| `.glass` / `.glass-panel` / `.glass-capsule` | Glass material: generic / large panel (radius 14) / 36px pill grouping toolbar buttons |
| `.btn`, `.btn-lg`, `.btn-primary`, `.btn-destructive`, `.btn-glass` | Capsule push buttons; `.btn-glass` floats on its own over content |
| `.btn-icon` (`aria-pressed` for toggles), `.btn-icon-sm` | Round borderless icon button (put inside a `.glass-capsule` in the toolbar) |
| `.field` | `<input>` / `<textarea>` (capsule / 12px radius) |
| `.select` | `<select>` capsule pop-up button |
| `.segmented` > `button[aria-pressed]` | Capsule segmented control with raised thumb |
| `.switch` | `<input type="checkbox">` toggle (38×22, stretchy knob on press) |
| `.list-row[aria-selected]` (+ `.row-secondary`) | Source-list row; accent capsule when window focused |
| `.group-box` > `.group-row` | System-Settings-style grouped form |
| `.sheet-backdrop` > `.sheet` | Glass sheet with spring entrance |
| `.menu`, `.menu-item`, `.menu-separator` | Glass popover / web context menu |
| `.scroll-edge-top` | Fade + blur where content slides under the floating toolbar |
| `.drag` | Window drag region (Electron); interactive children are auto `no-drag` |
| `.traffic-light-pad` | Left padding for traffic lights (macOS Electron, not fullscreen) |
| `.selectable` | Opt back into text selection (transcript text). Body is `user-select: none` |

## Infrastructure
- `hooks/useCommand.js` — `useCommand(id, fn)` binds menu-bar items (Electron) / keyboard shortcuts (web); return `false` from `fn` to let the browser handle the key. Ignored while a sheet is open. Ids: `settings`, `new-session`, `toggle-recording`, `pause-resume`, `toggle-overlay`, `export`, `rename`, `delete`, `find`, `toggle-sidebar`.
- `hooks/useRecording.js` — start/stop/pause/resume/new meeting + elapsed timer + chosen context.
- `utils/contextMenu.js` — `await showContextMenu(event, [{id,label,disabled}|{type:"separator"}])` → native menu in Electron, glass `.menu` on web.
- `hooks/useTheme.js` — `[pref, setTheme]`, pref ∈ `system|light|dark`; synced to `nativeTheme`.
- `utils/platform.js` — sets `data-platform`, `data-electron`, `data-vibrancy`, `data-fullscreen`, `.window-focused`, system accent.

## Motion
Springy, short: 160–320 ms with `cubic-bezier(0.3, 1.4, 0.5, 1)`-style overshoot for presses, toggles and sheet/menu entrances; plain ease-out for color/opacity. Pressed controls scale to 0.94–0.97. Recording indicator: red dot with `recording-pulse`. `prefers-reduced-motion` and `prefers-reduced-transparency` (all glass → opaque) are handled globally in `style.css`.

## Layout
```
┌ window (bg-window / native vibrancy on macOS) ──────────────────────────────┐
│ ╭ glass sidebar 240 ╮ ┌ content (bg-content, edge to edge) ──────────────────┐ │
│ │ ● ● ●  44px drag  │ │ (◫)  Title 15/sub 11      (✎ ⋯) (● Resume) (⧉ ⚙)    │ │ ← floating capsules
│ │ (search capsule)  │ │ ░░░░░░░░░░ scroll-edge fade ░░░░░░░░░░░░░░░░░░░░░░░ │ │
│ │ GROUP             │ │        transcript column (max 760, opaque)         │ │
│ │ (selected row)    │ │                                                    │ │
│ │  row              │ │     ╭ ● status │ Source [seg] langs  Context ╮     │ │ ← floating glass bar
│ ╰───────────────────╯ └────╰──────────────────────────────────────────╯─────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```
