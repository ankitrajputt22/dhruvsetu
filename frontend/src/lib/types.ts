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
  doi: string | null;
  source_url: string | null;
  summary: string | null;
  verification_status: string;
  is_demo_data: boolean;
};

export type Report = {
  id: string;
  title: string;
  publication_date: string | null;
  source_url: string | null;
  summary: string | null;
  verification_status: string;
  is_demo_data: boolean;
};

export type Dataset = {
  id: string;
  title: string;
  description: string | null;
  file_type: string | null;
  source_url: string | null;
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
  source_documents: LinkedDocument[];
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
  source_url: string | null;
  match_reason: string;
  search_mode: SearchMode;
};

export type RelatedDocumentResource = {
  id: string;
  type: string;
  title: string;
  href: string | null;
};

// Source details shown wherever a document is used as evidence.
export type SourceProvenance = {
  title: string;
  file_type: string | null;
  source_type: string | null;
  source_url: string | null;
  publication_date: string | null;
  verification_status: string | null;
  is_demo_data: boolean;
  related_resources: RelatedDocumentResource[];
};

export type LinkedDocument = SourceProvenance & {
  id: string;
  file_type: string;
  source_type: string;
  verification_status: string;
};

export type Document = LinkedDocument & {
  file_name: string;
  chunk_count: number;
};

export type DocumentDetail = Document & {
  created_at: string;
  first_page: number | null;
  last_page: number | null;
};

export type AssistantSource = SourceProvenance & {
  number: number;
  document_id: string;
  page_number: number | null;
  section_name: string | null;
  match_reason: string;
  href: string;
};

export type AssistantAnswer = {
  answer: string;
  sources: AssistantSource[];
};
