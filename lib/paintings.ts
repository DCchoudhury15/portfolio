// Night paintings shown with the projects and behind the hero. All are in the public domain
// (scans from Wikimedia Commons).
// strokes: how strongly the moving brush strokes show (1 = as on The Starry Night). Below 1 the
// painting itself stays clearer under fewer, lighter strokes.
export type Painting = { src: string; title: string; artist: string; year: string; focus: string; strokes?: number };

export const PAINTINGS: Record<string, Painting> = {
  hero: { src: "/paintings/hero.jpg", title: "Starry Night Over the Rhône", artist: "Vincent van Gogh", year: "1888", focus: "50% 40%", strokes: 0.3 },
  agentward: { src: "/paintings/agentward.jpg", title: "The Starry Night", artist: "Vincent van Gogh", year: "1889", focus: "55% 40%" },
  audio: { src: "/paintings/audio.jpg", title: "Nocturne: Blue and Gold, Old Battersea Bridge", artist: "James McNeill Whistler", year: "c. 1872", focus: "50% 18%", strokes: 0.25 },
  chatai: { src: "/paintings/chatai.jpg", title: "Café Terrace at Night", artist: "Vincent van Gogh", year: "1888", focus: "45% 45%", strokes: 0.25 },
  resumez: { src: "/paintings/resumez.jpg", title: "Two Men Contemplating the Moon", artist: "Caspar David Friedrich", year: "c. 1825", focus: "45% 50%", strokes: 0.3 },
};
