import { seededRandom } from './random'

// [background, primary, secondary]: muted, editorial combinations.
const PALETTES: [string, string, string][] = [
  ['#1c1a17', '#d8c29d', '#8c3b2a'],
  ['#efe6d4', '#1d2a3a', '#c2803d'],
  ['#2b3a33', '#e8dcc2', '#b5643c'],
  ['#3a1f2b', '#f0c9a8', '#d97a5c'],
  ['#0f1b2d', '#9db4c0', '#e8d5b0'],
  ['#d9cbb0', '#2f2a24', '#7d4e3a'],
  ['#4a3f35', '#e6b980', '#f3ead8'],
  ['#132a2a', '#5fa39a', '#f1e3c6'],
  ['#e4d3bf', '#a2422b', '#273238'],
  ['#221c2e', '#c9a7d8', '#e7d9b9'],
]

const SIZE = 600
const C = SIZE / 2

/**
 * Generates a deterministic abstract album cover as an SVG data URI.
 * Same seed → same cover, so tracks from one album share artwork.
 */
export function generateCover(seed: string): string {
  const rand = seededRandom(seed)
  const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)]
  const between = (min: number, max: number) => min + rand() * (max - min)

  const [bg, a, b] = pick(PALETTES)
  const style = Math.floor(rand() * 4)
  let shapes = ''

  switch (style) {
    case 0: {
      // Orb: a large disc, an offset smaller disc and a fine ring.
      const r = between(150, 215)
      const cx = between(C - 60, C + 60)
      const cy = between(C - 60, C + 60)
      shapes += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${a}"/>`
      shapes += `<circle cx="${cx + between(-120, 120)}" cy="${cy + between(-120, 120)}" r="${r * between(0.3, 0.55)}" fill="${b}"/>`
      shapes += `<circle cx="${C}" cy="${C}" r="${between(240, 270)}" fill="none" stroke="${a}" stroke-width="1.5" opacity="0.6"/>`
      break
    }
    case 1: {
      // Bands: tilted horizontal stripes.
      const count = 4 + Math.floor(rand() * 4)
      let y = -200
      const bands: string[] = []
      for (let i = 0; i < count + 4; i++) {
        const h = between(40, 140)
        const fill = i % 3 === 0 ? a : i % 3 === 1 ? b : bg
        bands.push(`<rect x="-300" y="${y}" width="1200" height="${h}" fill="${fill}"/>`)
        y += h
      }
      shapes += `<g transform="rotate(${between(-18, 18)} ${C} ${C})">${bands.join('')}</g>`
      break
    }
    case 2: {
      // Dot grid with varying sizes.
      const n = 4 + Math.floor(rand() * 2)
      const step = SIZE / n
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const r = pick([6, 14, 26, step * 0.42])
          shapes += `<circle cx="${step * (i + 0.5)}" cy="${step * (j + 0.5)}" r="${r}" fill="${rand() > 0.3 ? a : b}"/>`
        }
      }
      break
    }
    default: {
      // Arches: concentric half-discs rising from the bottom.
      const count = 4 + Math.floor(rand() * 3)
      const step = 300 / count
      for (let i = 0; i < count; i++) {
        const r = 300 - i * step
        const fill = i % 3 === 0 ? a : i % 3 === 1 ? b : bg
        shapes += `<path d="M ${C - r} ${SIZE} A ${r} ${r} 0 0 1 ${C + r} ${SIZE} Z" fill="${fill}"/>`
      }
      shapes += `<circle cx="${between(100, 500)}" cy="${between(80, 180)}" r="${between(22, 48)}" fill="${a}"/>`
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
<defs><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter></defs>
<rect width="${SIZE}" height="${SIZE}" fill="${bg}"/>${shapes}
<rect width="${SIZE}" height="${SIZE}" filter="url(#g)" opacity="0.14"/>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** A playlist's own artwork, or a generated cover when it has none (e.g. Liked Songs). */
export function playlistCover(playlist: { id: string; images: { url: string }[] }): string {
  return playlist.images[0]?.url ?? generateCover(`playlist/${playlist.id}`)
}
