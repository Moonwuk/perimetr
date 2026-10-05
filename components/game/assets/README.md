# Card artwork

The Cybercomic card direction was selected by the project owner on 2026-10-05.
Each of the 18 illustrations and the neutral metal frame was generated separately
with ImageGen from that reference. Illustrations contain no rules or prices;
`CardFace` renders current engine data as accessible HTML.

- Card art: 768 × 576, WebP quality 83.
- Shared frame: 640 × 960, WebP quality 85.
- Imports in `card-art.ts` are bundled by both Cloudflare and Android Vite builds.
- Hand art loads immediately; full-size library art loads lazily.
- No external image or font service is needed at runtime.

Oswald is bundled from the [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/oswald).
Its SIL Open Font License is included in `fonts/OFL-Oswald.txt`.
