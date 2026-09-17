# Thumbnail Studio identity

The mark uses two framing corners and a warm focal dot: compose, focus, refine. It is original artwork for this project. Use the supplied SVG for scalable display and the generated ICO for Windows shortcuts.

- Name: **Thumbnail Studio**. Keep both words together; avoid abbreviating the public product name.
- Primary color: `#536FBD` (studio blue).
- Focal accent: `#FFD49A` (warm amber), reserved for the mark.
- Text: `#EDF0F5`; secondary text: `#A0A9B8`.
- Surfaces: `#111318` canvas, `#17191E` panel, `#202329` controls; borders: `#30353D`.
- Interface accent: `#98ACF4`, with `#2C3651` for selected controls. The mark retains its original studio blue.
- Interface type: Segoe UI Variable Display for headings, Segoe UI for controls, Consolas for the brief counter, with system fallbacks.
- Voice: short, practical, and specific. Buttons describe the action: Copy prompt, New chat, References.
- Layout: a quiet toolbar, one optional side panel, and the native ChatGPT view. Avoid decorative dashboards or extra chat composers.
- The toolbar is 68 px high; the side panel is 380 px wide above the 760 px breakpoint. Keep CSS dimensions and `desktop/policy.cjs` native view bounds synchronized. Narrow windows show either the panel or chat.

Leave clear space of at least one focal-dot diameter around the mark. Keep the white frame and amber dot intact on the blue field. Do not combine it with OpenAI's logo or suggest an official affiliation.

Regenerate the Windows icon with `python scripts/create-icon.py` after installing the Pillow dependency.
