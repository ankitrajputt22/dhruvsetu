export type Institution = {
  id: string;
  name: string;
};

export type Scientist = {
  id: string;
  name: string;
  research_area: string | null;
  institution: Institution | null;
};

export type ResearchTopic = {
  id: string;
  name: string;
  description: string | null;
};

export type Location = {
  id: string;
  name: string;
  region: string | null;
};

export type Expedition = {
  id: string;
  name: string;
  expedition_number: string | null;
  summary: string | null;
  start_date: string | null;
  end_date: string | null;
  verification_status: string;
  is_demo_data: boolean;
};

export type Publication = {
  id: string;
  title: string;
  publication_year: number | null;
  summary: string | null;
  verification_status: string;
  is_demo_data: boolean;
};

export type Report = {
  id: string;
  title: string;
  publication_date: string | null;
  summary: string | null;
  verification_status: string;
  is_demo_data: boolean;
};

export type Dataset = {
  id: string;
  title: string;
  description: string | null;
  file_type: string | null;
  verification_status: string;
  is_demo_data: boolean;
};

export type MediaAsset = {
  id: string;
  title: string;
  media_type: string;
  description: string | null;
  verification_status: string;
  is_demo_data: boolean;
};

export type ExpeditionDetail = Expedition & {
  scientists: Scientist[];
  research_topics: ResearchTopic[];
  locations: Location[];
  publications: Publication[];
  reports: Report[];
  datasets: Dataset[];
  media_assets: MediaAsset[];
};

export type SearchResourceType =
  | "expedition"
  | "scientist"
  | "publication"
  | "dataset"
  | "topic"
  | "report";

export type SearchMode = "keyword" | "semantic";

export type SearchResult = {
  id: string;
  type: SearchResourceType;
  title: string;
  description: string | null;
  is_demo_data: boolean;
  verification_status: string | null;
  href: string | null;
  match_reason: string;
  search_mode: SearchMode;
};

export type RelatedDocumentResource = {
  id: string;
  type: string;
  title: string;
};

export type Document = {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  source_type: string;
  publication_date: string | null;
  verification_status: string;
  is_demo_data: boolean;
  chunk_count: number;
};

export type DocumentDetail = Document & {
  source_url: string | null;
  related_resources: RelatedDocumentResource[];
};
