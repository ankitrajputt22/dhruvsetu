import type { MapLocation } from "@/lib/types";

// The real seeded map locations, as GET /api/map returns them, for tests.
// The coordinates are the published values listed in the backend README.

const arctic14 = {
  id: "arctic-14",
  name: "14th Indian Arctic Expedition (2023-24)",
  expedition_number: null,
  verification_status: "uploaded",
  is_demo_data: false,
};
const arctic15 = {
  id: "arctic-15",
  name: "15th Indian Arctic Expedition (2024-25)",
  expedition_number: null,
  verification_status: "uploaded",
  is_demo_data: false,
};
const antarctic41 = {
  id: "isea-41",
  name: "41st Indian Scientific Expedition to Antarctica",
  expedition_number: "ISEA-41",
  verification_status: "uploaded",
  is_demo_data: false,
};
const arcticTopics = [{ id: "atmosphere", name: "Atmospheric Science" }];
const antarcticTopics = [{ id: "paleoclimate", name: "Paleoclimate and Ice Cores" }];

function station(name: string, description: string, sourceUrl: string) {
  return {
    id: `${name.toLowerCase()}-station`,
    name,
    description,
    source_url: sourceUrl,
    verification_status: "uploaded",
    is_demo_data: false,
  };
}

export const maitri: MapLocation = {
  id: "maitri",
  name: "Maitri Station",
  region: "Antarctica",
  description:
    "Location of India's Maitri research station. Coordinates 70°45′52″ S, 11°44′03″ E, from the NCPOR Maitri station page.",
  latitude: -70.764444,
  longitude: 11.734167,
  mappable: true,
  location_type: "station",
  polar_region: "antarctic",
  is_demo_data: false,
  stations: [
    station(
      "Maitri",
      "India's second research station in Antarctica, on the ice-free Schirmacher Oasis.",
      "https://ncpor.res.in/antarcticas/display/376-maitri-",
    ),
  ],
  expeditions: [antarctic41],
  expedition_count: 1,
  research_topics: antarcticTopics,
  datasets: [],
  documents: [{ id: "pib-41", title: "India launches the 41st Scientific Expedition to Antarctica" }],
};

export const bharati: MapLocation = {
  id: "bharati",
  name: "Bharati Station",
  region: "Antarctica",
  description:
    "Location of India's Bharati research station. Coordinates 69°24.41′ S, 76°11.72′ E, from the NCPOR Bharati station page.",
  latitude: -69.406833,
  longitude: 76.195333,
  mappable: true,
  location_type: "station",
  polar_region: "antarctic",
  is_demo_data: false,
  stations: [
    station(
      "Bharati",
      "Indian research station in Antarctica, commissioned on 18 March 2012.",
      "https://ncpor.res.in/antarcticas/display/377-bharati",
    ),
  ],
  expeditions: [antarctic41],
  expedition_count: 1,
  research_topics: antarcticTopics,
  datasets: [],
  documents: [],
};

export const himadri: MapLocation = {
  id: "himadri",
  name: "Himadri Station",
  region: "Arctic",
  description:
    "Location of India's Himadri research station. Coordinates 78°55′ N, 11°56′ E, from the NCPOR Arctic data portal (Himadri).",
  latitude: 78.916667,
  longitude: 11.933333,
  mappable: true,
  location_type: "station",
  polar_region: "arctic",
  is_demo_data: false,
  stations: [
    station(
      "Himadri",
      "India's first Arctic research station, at Ny-Ålesund, Svalbard, Norway.",
      "https://ncpor.res.in/app/webroot/pages/view/340-himadri-station",
    ),
  ],
  expeditions: [arctic14, arctic15],
  expedition_count: 2,
  research_topics: arcticTopics,
  datasets: [],
  documents: [],
};

export const kongsfjorden: MapLocation = {
  id: "kongsfjorden",
  name: "Kongsfjorden (IndARC mooring site)",
  region: "Arctic",
  description: "Inner Kongsfjorden, Svalbard, where the IndARC mooring was deployed.",
  latitude: 78.933333,
  longitude: 12,
  mappable: true,
  location_type: "expedition_location",
  polar_region: "arctic",
  is_demo_data: false,
  stations: [],
  expeditions: [arctic15],
  expedition_count: 1,
  research_topics: arcticTopics,
  datasets: [],
  documents: [],
};

export const djupranen: MapLocation = {
  id: "djupranen",
  name: "Djupranen Ice Rise",
  region: "Antarctica",
  description: "Ice rise in coastal Dronning Maud Land, where the ice core IND36/9 was drilled.",
  latitude: -70.18,
  longitude: 9.18,
  mappable: true,
  location_type: "other",
  polar_region: "antarctic",
  is_demo_data: false,
  stations: [],
  expeditions: [],
  expedition_count: 0,
  research_topics: [],
  datasets: [],
  documents: [],
};

// A location with no stored coordinates: listed as text, never on the globe.
export const unplaced: MapLocation = {
  id: "unplaced",
  name: "Field area without coordinates",
  region: null,
  description: null,
  latitude: null,
  longitude: null,
  mappable: false,
  location_type: "other",
  polar_region: null,
  is_demo_data: false,
  stations: [],
  expeditions: [],
  expedition_count: 0,
  research_topics: [],
  datasets: [],
  documents: [],
};

export const realLocations: MapLocation[] = [bharati, djupranen, himadri, kongsfjorden, maitri];
