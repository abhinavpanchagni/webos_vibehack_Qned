/**
 * Configuration for Cinematic Favourite Characters gallery.
 * Edit this file to add, modify, or rearrange favourite characters,
 * or to configure direct content-specific deep links once verified on LG webOS.
 */
window.CHARACTERS_CONFIG = {
  enabled: true,

  // Character definitions in display order (left to right)
  characters: [
    {
      id: "steve",
      character: "Steve Harrington",
      title: "Stranger Things",
      category: "Series",
      platform: "netflix",
      platformName: "Netflix",
      badgeType: "netflix",
      image: "assets/characters/steve.webp",
      glowColor: "#E50914",
      accentColor: "#FF3344",
      glowGradient: "radial-gradient(ellipse at 50% 60%, rgba(229, 9, 20, 0.65) 0%, rgba(229, 9, 20, 0.22) 50%, rgba(0, 0, 0, 0) 75%)",
      visualStyle: "electric",
      // Content-specific deep-link configuration (separate from UI)
      deepLink: {
        contentId: null,       // e.g. "80057281" for Stranger Things once verified
        query: null
      }
    },
    {
      id: "rengoku",
      character: "Kyojuro Rengoku",
      title: "Demon Slayer",
      category: "Anime",
      platform: "netflix",
      platformName: "Netflix",
      badgeType: "netflix",
      image: "assets/characters/rengoku.webp",
      glowColor: "#FF6B00",
      accentColor: "#FFAE00",
      glowGradient: "radial-gradient(ellipse at 50% 60%, rgba(255, 107, 0, 0.70) 0%, rgba(255, 174, 0, 0.28) 48%, rgba(0, 0, 0, 0) 75%)",
      visualStyle: "flame",
      deepLink: {
        contentId: null,
        query: null
      }
    },
    {
      id: "joe",
      character: "Joe Goldberg",
      title: "YOU",
      category: "Series",
      platform: "netflix",
      platformName: "Netflix",
      badgeType: "netflix",
      image: "assets/characters/joe.webp",
      glowColor: "#8B0000",
      accentColor: "#C41E3A",
      glowGradient: "radial-gradient(ellipse at 50% 60%, rgba(139, 0, 0, 0.70) 0%, rgba(178, 34, 34, 0.25) 50%, rgba(0, 0, 0, 0) 75%)",
      visualStyle: "crimson",
      deepLink: {
        contentId: null,
        query: null
      }
    },
    {
      id: "benjamin",
      character: "Benjamin & Andie",
      title: "How to Lose a Guy in 10 Days",
      category: "Movie",
      platform: "netflix",
      platformName: "Netflix",
      badgeType: "netflix",
      image: "assets/characters/benjamin.webp",
      glowColor: "#D4AF37",
      accentColor: "#E8C868",
      glowGradient: "radial-gradient(ellipse at 50% 60%, rgba(212, 175, 55, 0.65) 0%, rgba(229, 193, 88, 0.24) 48%, rgba(0, 0, 0, 0) 75%)",
      visualStyle: "gold",
      deepLink: {
        contentId: null,
        query: null
      }
    },
    {
      id: "hannah",
      character: "Hannah & Garrett",
      title: "Off Campus",
      category: "Series (2026)",
      platform: "amazon",
      platformName: "Prime Video",
      badgeType: "amazon",
      image: "assets/characters/hannah.webp",
      glowColor: "#C71585",
      accentColor: "#E056B3",
      glowGradient: "radial-gradient(ellipse at 50% 60%, rgba(199, 21, 133, 0.65) 0%, rgba(153, 50, 204, 0.25) 50%, rgba(0, 0, 0, 0) 75%)",
      visualStyle: "rose",
      deepLink: {
        asin: null,
        url: null
      }
    }
  ]
};
