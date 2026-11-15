# Design System: Sistem Kasir Minimarket

## 1. Overview

A point-of-sale web app for a small Indonesian minimarket, used all day by cashiers and a store owner. The visual character is modern, clean, and calm: a dark indigo sidebar on the left, a light content area, white cards with soft rounded corners, and plenty of whitespace. It should feel like a reliable business dashboard, not a marketing site. Speed and legibility matter more than decoration.

All interface text is in Indonesian.

## 2. Colors

| Role | Name | Hex | Used for |
|---|---|---|---|
| Primary | Indigo | #4F46E5 | Primary buttons, active links, key headings |
| Primary hover | Deep Indigo | #4338CA | Hover state of primary buttons |
| Primary tint | Soft Indigo | #EEF2FF | Active/hover row background, selected states |
| Sidebar | Midnight Indigo | #312E81 | Sidebar background |
| Accent | Amber | #F59E0B | Highlights, product icons, discount labels, "Menipis" status |
| Success | Green | #22C55E | Successful transaction, "Aman" and "Selesai" status, change amount |
| Danger | Red | #EF4444 | Cancel/delete, "Habis" status, errors |
| Info | Blue | #3B82F6 | The "Proses Pembayaran" button, informational links |
| Page background | Mist | #F8FAFC | App background |
| Surface | White | #FFFFFF | Cards, tables, dialogs |
| Border | Slate 200 | #E2E8F0 | Table lines, input borders, dividers |
| Text | Slate 800 | #1E293B | Main text |
| Text muted | Slate 500 | #64748B | Secondary text, placeholders |

Text must keep at least 4.5:1 contrast against its background. Never rely on color alone for status; always add a text label.

## 3. Typography

- Headings: Poppins, SemiBold or Bold.
- Body and numbers: Inter. Use tabular numerals in tables and money values.

| Level | Size | Weight |
|---|---|---|
| Page title | 24 px | SemiBold |
| Card title | 18 px | SemiBold |
| Body | 14 px (never smaller) | Regular |
| Form label | 13 px | Medium |
| Cashier grand total | 36 px | Bold |
| Change amount | 32 px | Bold |

Money format: `Rp 15.500` (dot as thousands separator, no decimals). Date format: `10 Okt 2026, 14:32`.

## 4. Shape, Spacing, and Elevation

- Spacing scale in multiples of 4 px: 4, 8, 12, 16, 24, 32.
- Corner radius: 8 px for inputs and buttons, 12 px for cards and dialogs, fully rounded for badges.
- Elevation is subtle: cards use a very soft shadow (`0 1px 3px rgba(15,23,42,0.08)`); dialogs use a slightly stronger one with a dimmed backdrop. No heavy shadows, no gradients, no glass effects.
- Layout: sidebar 240 px wide, top header 64 px tall, content padding 24 px, base canvas 1440 px.

## 5. Components

- **Sidebar:** Midnight Indigo background. Logo with a shopping-cart icon and the name "Minimarket" at the top. Menu items have an icon and label in white/light indigo text; the active item has an Indigo (#4F46E5) filled pill. User profile and a "Keluar" action sit at the bottom.
- **Header:** page title on the left; on the right the date, user name, a role badge (Admin or Kasir), and an avatar.
- **Primary button:** Indigo fill, white text, 40 px tall, 8 px radius. Secondary button: white with a slate border. Destructive button: red outline (for "Batal") or red fill (for confirming deletion). The payment action is a large full-width Info Blue button.
- **Inputs:** 40 px tall, 1 px slate border, an Indigo focus ring, and a red error message below the field. The search/scan field has a magnifier icon and the placeholder "Scan barcode atau cari produk...".
- **Tables:** light grey header row, 48 px rows, Soft Indigo hover, numbers right-aligned, actions in the last column, pagination below.
- **Badges:** small pills with text. Aman (green), Menipis (amber), Habis (red), Selesai (green), Dibatalkan (grey-red), Admin (indigo), Kasir (blue-grey).
- **Stat cards:** an icon at top left, a small muted label, a large number.
- **Dialogs:** white, 12 px radius, title, content, and a footer with the cancel button on the left and the main action on the right.
- **Toasts:** top right; green for success, red for error.
- **Empty states:** a simple icon, one short sentence, and one action button.

## 6. Do's and Don'ts

Do:
- Use the exact colors and fonts above on every screen.
- Keep each screen uncluttered, with one clear primary action.
- Make totals, change, and prices the most prominent numbers on the cashier screen.
- Reuse the same table, dialog, badge, and form components everywhere.
- Show status with both color and text.

Don't:
- Don't introduce new accent colors, dark mode, gradients, or decorative illustrations.
- Don't use text smaller than 14 px for body content.
- Don't add features that are not in the brief (no online payment, no hold-transaction, no activity log, no loyalty points, no multi-branch).
- Don't use placeholder text like "Lorem ipsum"; use realistic Indonesian minimarket data (Indomie Goreng, Aqua 600ml, Chitato 68gr, and so on).
