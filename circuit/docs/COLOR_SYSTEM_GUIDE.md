# Octave Design System - Color Usage Guide

> **Last Updated**: 2025-10-31
> **Design System Version**: 2.0

## Overview

Octave's color system is built on **Apple Human Interface Guidelines** with OKLCH color space for perceptual uniformity. This guide helps you choose the right color tokens for your components.

---

## 🎨 Color Token Categories

### 1. Background Hierarchy

Use these for layering UI surfaces (light to dark in light mode, dark to light in dark mode).

| Token | Usage | Example |
|-------|-------|---------|
| `--background-primary` | Main window background | App container |
| `--background-secondary` | Elevated cards/panels | Cards, modals |
| `--background-tertiary` | Nested elevated surfaces | Card sections |
| Tailwind | `bg-background` | Auto-maps to primary |

**Example**:
```tsx
<div className="bg-background">  {/* Main app */}
  <div className="bg-card">       {/* Card (secondary) */}
    <div className="bg-muted">    {/* Section (tertiary) */}
  </div>
</div>
```

---

### 2. Text Hierarchy (Labels)

Use these for text based on importance. **All meet WCAG AA standards.**

| Token | Opacity | Usage | WCAG AA |
|-------|---------|-------|---------|
| `--label-primary` | 100% | Primary headings, body text | ✅ 21:1 |
| `--label-secondary` | 95% / 90% | Supporting text, captions | ✅ 19.8:1 |
| `--label-tertiary` | **60% / 40%** | Placeholders, subtle hints | ✅ **4.8:1** |
| `--label-quaternary` | 25% / 18% | **Decorative only** (not for text) | ❌ 1.9:1 |
| Tailwind | - | `text-foreground`, `text-foreground-muted` | - |

**⚠️ Important**: `label-quaternary` does NOT meet accessibility standards for text. Use only for decorative UI elements (dividers, subtle backgrounds).

**Example**:
```tsx
<h1 className="text-[var(--label-primary)]">Main Heading</h1>
<p className="text-[var(--label-secondary)]">Supporting text</p>
<span className="text-[var(--label-tertiary)]">Placeholder</span>
{/* NEVER use label-quaternary for text */}
<div className="border-[var(--label-quaternary)]" /> {/* OK for borders */}
```

---

### 3. Semantic Colors

Use these for conveying meaning and status.

| Token | Purpose | Tailwind |
|-------|---------|----------|
| `--destructive` | Errors, delete actions | `bg-destructive`, `text-destructive` |
| `--success` | Success states, confirmations | `bg-success`, `text-success` |
| `--warning` | Warnings, caution | `bg-warning`, `text-warning` |
| `--info` | Information, neutral notices | `bg-info`, `text-info` |

**With foreground colors**:
```tsx
<button className="bg-destructive text-destructive-foreground">
  Delete
</button>
```

---

### 4. Interactive States

Use these for hover, active, focus, and disabled states.

| Token | Purpose | Opacity | Usage |
|-------|---------|---------|-------|
| `--state-hover` | Hover overlays | 4% | `hover:bg-[var(--state-hover)]` |
| `--state-active` | Active/pressed overlays | 8% | `active:bg-[var(--state-active)]` |
| `--state-focus-ring` | Focus indicators | - | `focus:ring-[var(--state-focus-ring)]` |
| `--state-disabled-opacity` | Disabled state | 50% | `opacity: var(--state-disabled-opacity)` |

**Example**:
```tsx
<button className="
  hover:bg-[var(--state-hover)]
  active:bg-[var(--state-active)]
  focus:ring-2 focus:ring-[var(--state-focus-ring)]
  disabled:opacity-[var(--state-disabled-opacity)]
">
  Click me
</button>
```

---

### 5. Glass/Overlay Effects

Use these for glassmorphism and subtle overlays.

| Token | Purpose | Usage |
|-------|---------|-------|
| `--glass-bg` | Glass background | Modal backdrops, panels |
| `--glass-border` | Glass borders | Subtle separators |
| `--glass-hover` | Glass hover state | `hover:bg-[var(--glass-hover)]` |
| `--overlay-thin` | 2% overlay | Very subtle backgrounds |
| `--overlay-light` | 4% overlay | Hover states (alias: `--state-hover`) |
| `--overlay-medium` | 8% overlay | Active states (alias: `--state-active`) |
| `--overlay-strong` | 12% overlay | Emphasis overlays |

**Example**:
```tsx
<div className="border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)]">
  Glass card
</div>
```

---

### 6. Border System

Use these for subtle borders and dividers.

| Token | Opacity | Usage |
|-------|---------|-------|
| `--border-thin` | 5% | Very subtle dividers |
| `--border-light` | 10% | Standard borders |
| `--border-medium` | 15% | Emphasized borders |
| `--separator-opaque` | 10% | Solid dividers (alias for border-light) |
| `--separator-translucent` | 5% | Subtle dividers (alias for border-thin) |

---

### 7. Status Colors (Git-specific)

Use these for Git-related status displays.

| Token | Purpose | Semantic Equivalent |
|-------|---------|---------------------|
| `--status-merged` | Purple - PR merged | *(unique)* |
| `--status-working` | Yellow-orange - Working tree changes | ≈ `--warning` |
| `--status-ahead` | Blue - Commits ahead | ≈ `--info` |
| `--status-behind` | Red - Commits behind | ≈ `--destructive` |
| `--status-diverged` | Orange - Branches diverged | *(unique)* |
| `--status-synced` | Green - In sync | ≈ `--success` |
| `--status-local` | Gray - Local only | *(unique)* |

**Tailwind**: `text-status-merged`, `bg-status-ahead`, etc.

---

### 8. Brand Colors

| Token | Purpose | Usage |
|-------|---------|-------|
| `--octave-orange` | Octave brand color | Accent highlights, CTAs |
| `--octave-error` | Error states | Alias to `--destructive` |

---

## 🎯 Quick Decision Tree

### "Which color token should I use?"

**For backgrounds:**
- Main app container → `--background-primary` or `bg-background`
- Card/modal → `--background-secondary` or `bg-card`
- Nested section → `--background-tertiary` or `bg-muted`

**For text:**
- Main content → `--label-primary` or `text-foreground`
- Supporting text → `--label-secondary` or `text-foreground-muted`
- Placeholders → `--label-tertiary` or `text-muted-foreground`
- **Never use `--label-quaternary` for text!**

**For interactive states:**
- Hover → `--state-hover` or `hover:bg-[var(--overlay-light)]`
- Active/Pressed → `--state-active` or `active:bg-[var(--overlay-medium)]`
- Focus ring → `--state-focus-ring` or `focus:ring-[var(--ring)]`

**For semantic meaning:**
- Error/Delete → `--destructive` or `bg-destructive`
- Success → `--success` or `bg-success`
- Warning → `--warning` or `bg-warning`
- Info → `--info` or `bg-info`

**For glass effects:**
- Background → `--glass-bg`
- Border → `--glass-border`
- Hover → `--glass-hover`

---

## ✅ Best Practices

### 1. **Use Tailwind classes when possible**
```tsx
// ✅ Good - Leverages Tailwind
<div className="bg-background text-foreground">

// ⚠️ OK - When Tailwind class doesn't exist
<div className="bg-[var(--glass-bg)]">
```

### 2. **Layer backgrounds correctly**
```tsx
// ✅ Good - Clear hierarchy
<div className="bg-background">
  <div className="bg-card">
    <div className="bg-muted">
    </div>
  </div>
</div>
```

### 3. **Meet accessibility standards**
```tsx
// ✅ Good - WCAG AA compliant
<p className="text-[var(--label-tertiary)]">Placeholder</p>

// ❌ Bad - Not accessible for text
<p className="text-[var(--label-quaternary)]">Text</p>

// ✅ OK - Quaternary for decorative only
<div className="border-[var(--label-quaternary)]" />
```

### 4. **Use semantic colors for meaning**
```tsx
// ✅ Good - Clear meaning
<button className="bg-destructive text-destructive-foreground">
  Delete
</button>

// ❌ Bad - No semantic meaning
<button className="bg-red-500 text-white">
  Delete
</button>
```

### 5. **Use state tokens for interactions**
```tsx
// ✅ Good - Consistent with system
<button className="hover:bg-[var(--state-hover)] active:bg-[var(--state-active)]">

// ❌ Bad - Hardcoded values
<button className="hover:bg-white/10 active:bg-white/20">
```

---

## 🚫 Common Mistakes

### ❌ Using hardcoded colors
```tsx
// ❌ Bad
<div className="bg-white text-black">
<div style={{ backgroundColor: '#E0E0E0' }}>
```

### ❌ Using label-quaternary for text
```tsx
// ❌ Bad - Not accessible
<p className="text-[var(--label-quaternary)]">Important text</p>

// ✅ Good - Use tertiary or secondary
<p className="text-[var(--label-tertiary)]">Placeholder</p>
```

### ❌ Mixing opacity values inconsistently
```tsx
// ❌ Bad - Inconsistent with system
<button className="hover:bg-white/15 active:bg-white/25">

// ✅ Good - Use state tokens
<button className="hover:bg-[var(--state-hover)] active:bg-[var(--state-active)]">
```

### ❌ Skipping semantic colors
```tsx
// ❌ Bad - No meaning
<button className="bg-red-500">Delete</button>

// ✅ Good - Semantic meaning
<button className="bg-destructive text-destructive-foreground">Delete</button>
```

---

## 📚 Additional Resources

- **Apple Human Interface Guidelines**: https://developer.apple.com/design/human-interface-guidelines/
- **WCAG Contrast Guidelines**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- **OKLCH Color Space**: https://oklch.com/

---

## 🔄 Version History

- **v2.0** (2025-10-31): Added interactive state tokens, improved WCAG compliance
- **v1.1** (2025-10-31): Consolidated status colors, added glass/overlay system
- **v1.0**: Initial Apple HIG-based design system
