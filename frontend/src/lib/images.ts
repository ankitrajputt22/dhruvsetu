// Every photograph the site shows. Each file is stored in public/images and
// is listed with its licence in public/images/ATTRIBUTIONS.md. Add an image
// here only after its licence has been checked.

export type SiteImage = {
  src: string;
  // Says only what the photograph shows.
  alt: string;
  // A short line for under the photograph and for the Image Credits page.
  caption: string;
  credit: string;
  licence: string;
  licenceUrl: string | null;
  // The page the file was taken from.
  sourceUrl: string;
};

const COMMONS = "https://commons.wikimedia.org/wiki/File:";

export const siteImages = {
  homeHero: {
    src: "/images/home/larsen-c-icebridge-2017.jpg",
    alt: "Snow-covered mountains and glaciers in Antarctica, seen from an aircraft on a NASA Operation IceBridge flight over the Larsen C ice shelf",
    caption: "Mountains and glaciers near the Larsen C ice shelf, Antarctica, 31 October 2017.",
    credit: "NASA Goddard Space Flight Center, Operation IceBridge",
    licence: "CC BY 2.0",
    licenceUrl: "https://creativecommons.org/licenses/by/2.0",
    sourceUrl: `${COMMONS}Operation_IceBridge_View_of_Larsen_C_(26792514249).jpg`,
  },
  authPanel: {
    src: "/images/auth/antarctic-mountains-icebridge-2012.jpg",
    alt: "Antarctic mountains rising out of the ice under a cloudy sky, seen from an aircraft",
    caption:
      "Mountains seen during a NASA Operation IceBridge survey of the Getz Ice Shelf, Antarctica, 27 October 2012.",
    credit: "NASA / Christy Hansen",
    licence: "Public domain",
    licenceUrl: null,
    sourceUrl: `${COMMONS}Antarctic_mountains_(8145725224).jpg`,
  },
  maitriStation: {
    src: "/images/stations/maitri-station.jpg",
    alt: "Main building of India's Maitri research station in Antarctica, on a snow-covered slope",
    caption: "Maitri, India's research station in the Schirmacher Oasis, Antarctica.",
    credit: "Prakash khatarkar",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: `${COMMONS}मैत्री,_भारतीय_स्टेशन_अंटार्कटिक_महाद्वीप.jpg`,
  },
  maitriAerial: {
    src: "/images/stations/maitri-aerial-2005.jpg",
    alt: "Aerial view of the buildings of India's Maitri research station in Antarctica",
    caption: "Aerial view of Maitri station, Antarctica, 2 February 2005.",
    credit: "Ministry of Science and Technology, Government of India, through the Press Information Bureau",
    licence: "Government Open Data License - India (GODL)",
    licenceUrl: "https://data.gov.in/sites/default/files/Gazette_Notification_OGDL.pdf",
    sourceUrl: `${COMMONS}An_aerial_view_of_the_Indian_Station_Maitri,_Antarctica_on_February_2,_2005.jpg`,
  },
  nyAlesund: {
    src: "/images/stations/ny-alesund-kongsfjorden-2012.jpg",
    alt: "The research settlement of Ny-Ålesund on the shore of Kongsfjorden, Svalbard, below snow-streaked mountains",
    caption:
      "Ny-Ålesund seen from Kongsfjorden, Svalbard, 9 August 2012. India's Himadri station is in Ny-Ålesund.",
    credit: "Bjoertvedt",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    sourceUrl: `${COMMONS}Ny-Aalesund_Zeppelinfjellet_IMG_6394.JPG`,
  },
  schirmacherHills: {
    src: "/images/expeditions/schirmacher-hills-aerial-1983.jpg",
    alt: "Aerial view of the Schirmacher Hills in Antarctica: rocky ground with small lakes, and the ice sheet beyond",
    caption:
      "Aerial view of the Schirmacher Hills, Antarctica, January 1983. Maitri station was later built here.",
    credit: "Pavan Nair",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    sourceUrl: `${COMMONS}An_aerial_view_of_Schirmacher_Hills.jpg`,
  },
  kongsfjordenShore: {
    src: "/images/expeditions/kongsfjorden-shore-2013.jpg",
    alt: "An old wooden hut on the shore of Kongsfjorden near Ny-Ålesund, Svalbard, with a small piece of ice floating in the fjord",
    caption: "The shore of Kongsfjorden near Ny-Ålesund, Svalbard, 8 August 2013.",
    credit: "Rob Oo",
    licence: "CC BY 2.0",
    licenceUrl: "https://creativecommons.org/licenses/by/2.0",
    sourceUrl: `${COMMONS}Remains,_Kongsfjorden,_Ny-Alesund.jpg`,
  },
} satisfies Record<string, SiteImage>;

// The photograph for a location on the Polar Map, with a caption that says
// exactly what it shows. A location without a licensed photograph gets none:
// there is none of Bharati, and none of the Himadri building itself.
export function locationPhoto(location: {
  name: string;
  stations: { name: string }[];
}): { image: SiteImage; caption: string } | null {
  const station = location.stations[0]?.name;
  if (station === "Maitri") {
    return { image: siteImages.maitriStation, caption: siteImages.maitriStation.caption };
  }
  if (station === "Himadri") {
    return { image: siteImages.nyAlesund, caption: "Ny-Ålesund, where Himadri is located." };
  }
  if (station === undefined && location.name.startsWith("Kongsfjorden")) {
    return { image: siteImages.kongsfjordenShore, caption: siteImages.kongsfjordenShore.caption };
  }
  return null;
}

export function photoCredit(image: SiteImage): string {
  return `Photo: ${image.credit}, ${image.licence}`;
}

// The photographs show the region an expedition worked in. None of them was
// taken on the expedition itself, and the captions say what they do show.
const regionImages = {
  arctic: {
    banner: siteImages.nyAlesund,
    cards: [siteImages.nyAlesund, siteImages.kongsfjordenShore],
  },
  antarctic: {
    banner: siteImages.maitriStation,
    cards: [siteImages.maitriAerial, siteImages.maitriStation],
  },
};

function expeditionRegion(name: string): keyof typeof regionImages | null {
  // "Antarctic" contains "arctic", so the Arctic test needs a whole word.
  if (/\barctic\b/i.test(name)) return "arctic";
  if (/antarctic/i.test(name)) return "antarctic";
  return null;
}

export function expeditionBanner(name: string): SiteImage | null {
  const region = expeditionRegion(name);
  return region ? regionImages[region].banner : null;
}

// One image for each card, in the order of the names. Cards of the same
// region take turns with its photographs, so neighbours do not repeat one.
export function expeditionCardImages(names: string[]): (SiteImage | null)[] {
  const used = { arctic: 0, antarctic: 0 };
  return names.map((name) => {
    const region = expeditionRegion(name);
    if (region === null) return null;
    const cards = regionImages[region].cards;
    return cards[used[region]++ % cards.length];
  });
}
