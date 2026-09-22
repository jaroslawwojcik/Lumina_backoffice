# Lumina backoffice design system

## Direction

Modern-minimal editorial workbench. The interface is dense enough for content operations, but every screen has one clear primary action and one containment layer. Navigation is quiet and persistent; data tables and forms carry the hierarchy.

## Typography

- Display and UI actions: Manrope Variable, 700.
- Body and form copy: Source Sans 3 Variable, 400–600.
- Technical identifiers: system monospace only where their raw form is useful.

## Tokens and components

`src/tokens.css` is the source of truth. MUI maps its palette, typography, spacing, radii, and state colours to these roles. Buttons and inputs share a 44 px minimum height. Focus rings are immediate and input border width is stable. Tables use tabular figures.

## Responsive and motion

The shell supports 320 px and uses `100dvh`. Page padding follows the 4 px scale. Controls reflow rather than wrap their labels. Hover styling is limited to fine pointers; reduced-motion preferences remove nonessential transitions.

## Workflow rules

Creation screens expose one primary CTA. In-flight actions name the operation. Raw domain enums are translated for operators. Release activation requires a consequence summary and explicit confirmation.

## Exports

### CSS

See `src/tokens.css`.

### Tailwind v4

```css
@theme { --font-display: "Manrope Variable", sans-serif; --font-body: "Source Sans 3 Variable", sans-serif; --color-paper: oklch(97% 0.008 300); --color-ink: oklch(22% 0.025 300); --color-accent: oklch(46% 0.12 305); --radius-card: 0.75rem; }
```

### DTCG

```json
{"color":{"paper":{"$value":"oklch(97% 0.008 300)","$type":"color"},"ink":{"$value":"oklch(22% 0.025 300)","$type":"color"},"accent":{"$value":"oklch(46% 0.12 305)","$type":"color"}},"font":{"display":{"$value":"Manrope Variable, sans-serif","$type":"fontFamily"},"body":{"$value":"Source Sans 3 Variable, sans-serif","$type":"fontFamily"}}}
```

### shadcn/ui

```css
:root { --background: 97% 0.008 300; --foreground: 22% 0.025 300; --primary: 46% 0.12 305; --primary-foreground: 98% 0.008 300; --border: 88% 0.018 300; --ring: 20% 0.06 305; --radius: 0.75rem; }
```
