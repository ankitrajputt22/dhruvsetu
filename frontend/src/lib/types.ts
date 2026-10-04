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
  latitude: number | null;
  longitude: number | null;
};

export type MapLocationType = "station" | "expedition_location" | "other";

export type MapStation = {
  id: string;
  name: string;
  description: string | null;
  verification_status: string;
  is_demo_data: boolean;
};

export type MapExpedition = {
  id: string;
  name: string;
  expedition_number: string | null;
  verification_status: string;
  is_demo_data: boolean;
};

export type MapRecord = {
  id: string;
  title: string;
};

export type MapLocation = {
  id: string;
  name: string;
  region: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  // True when the stored coordinates can be drawn on the web map.
  mappable: boolean;
  location_type: MapLocationType;
  polar_region: "antarctic" | "arctic" | null;
  is_demo_data: boolean;
  stations: MapStation[];
  expeditions: MapExpedition[];
  expedition_count: number;
  // Connected through the related expeditions, not directly to the location.
  research_topics: { id: string; name: string }[];
  datasets: MapRecord[];
  documents: MapRecord[];
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

export type DatasetListItem = Dataset & {
  created_at: string;
  has_file: boolean;
  related_resources: RelatedDocumentResource[];
  research_topics: ResearchTopic[];
};

export type DatasetFileInfo = {
  file_name: string;
  file_type: string | null;
  size_bytes: number | null;
  available: boolean;
  previewable: boolean;
  preview_message: string | null;
};

export type DatasetDetail = DatasetListItem & {
  file: DatasetFileInfo | null;
  // Display name of the researcher who submitted it, when there is one.
  submitted_by: string | null;
};

export type FilterOption = {
  id: string;
  name: string;
};

export type DatasetFilters = {
  file_types: string[];
  verification_statuses: string[];
  research_topics: FilterOption[];
  expeditions: FilterOption[];
};

export type DatasetCell = number | string | null;

export type DatasetColumn = {
  name: string;
  // Detected from the file contents, not official metadata.
  type: "number" | "text" | "empty";
  statistics: {
    count: number;
    minimum: number;
    maximum: number;
    mean: number;
  } | null;
};

export type DatasetPreview = {
  file_type: string;
  columns: DatasetColumn[];
  rows: DatasetCell[][];
  row_count: number;
  column_count: number;
  preview_limit: number;
  statistics_row_count: number;
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
  // Display name of the researcher who submitted it, when there is one.
  submitted_by: string | null;
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

export type DataLabStatus = {
  enabled: boolean;
  supported_file_types: string[];
  cell_timeout_seconds: number;
  idle_timeout_minutes: number;
};

export type DataLabStarterCell = {
  title: string;
  code: string;
};

export type DataLabSession = {
  session_id: string;
  dataset_id: string;
  dataset_title: string;
  file_type: string;
  // Where the dataset appears inside the session, never a host path.
  data_path: string;
  starter_cells: DataLabStarterCell[];
  cell_timeout_seconds: number;
  idle_timeout_minutes: number;
  created_at: string;
};

export type DataLabOutput =
  | { type: "text"; stream: "stdout" | "stderr" | "result"; text: string }
  | {
      type: "table";
      columns: string[];
      index: string[];
      index_name: string | null;
      rows: DatasetCell[][];
      total_rows: number;
      total_columns: number;
    }
  | { type: "image"; media_type: "image/png"; data: string }
  | { type: "error"; name: string; message: string; traceback: string };

export type DataLabResult = {
  status: "ok" | "error" | "timeout" | "kernel_died";
  outputs: DataLabOutput[];
  truncated: boolean;
  execution_count: number | null;
  state_lost: boolean;
  duration_ms: number;
};

export type OutreachResourceType =
  | "expedition"
  | "publication"
  | "dataset"
  | "document"
  | "report";

export type OutreachAudience = "student" | "teacher" | "journalist" | "public";

export type OutreachFormat =
  | "short_explanation"
  | "social_post"
  | "classroom_note"
  | "news_brief";

export type OutreachSourceOption = {
  resource_type: OutreachResourceType;
  id: string;
  title: string;
  verification_status: string;
  is_demo_data: boolean;
};

export type OutreachWarning = {
  code: string;
  message: string;
};

export type OutreachSourceDetail = {
  resource_type: OutreachResourceType;
  type_label: string;
  id: string;
  title: string;
  summary: string | null;
  verification_status: string;
  is_demo_data: boolean;
  source_url: string | null;
  href: string | null;
  facts: { label: string; value: string }[];
  topics: { name: string; description: string | null }[];
  related_resources: RelatedDocumentResource[];
  media: { title: string; media_type: string }[];
  warnings: OutreachWarning[];
};

export type OutreachResult = {
  generator: string;
  draft: {
    audience: OutreachAudience;
    format: OutreachFormat;
    title: string;
    sections: { heading: string; body: string }[];
    text: string;
  };
  source: OutreachSourceDetail;
  warnings: OutreachWarning[];
};

export type AdminStatusCount = {
  record_type: string;
  type_label: string;
  uploaded: number;
  reviewed: number;
  verified: number;
};

export type AdminRecord = {
  record_type: string;
  type_label: string;
  id: string;
  title: string;
  verification_status: string;
  is_demo_data: boolean;
  source_url: string | null;
  created_at: string;
};

export type AdminRecordDetail = AdminRecord & {
  description: string | null;
  facts: { label: string; value: string }[];
  related_resources: RelatedDocumentResource[];
  // The public page for this record, when it has one.
  href: string | null;
  changes: {
    from_status: string;
    to_status: string;
    changed_at: string;
    changed_by: string | null;
  }[];
};

export type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: "user" | "researcher" | "admin";
  is_active: boolean;
  created_at: string;
};

export type ResearcherRequestStatus = "pending" | "approved" | "rejected";

// Where an account stands. Only the role gives researcher access.
export type ResearcherAccessStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected"
  | "removed";

export type ResearcherRequestOwn = {
  id: string;
  status: ResearcherRequestStatus;
  institution: string;
  research_area: string;
  designation: string | null;
  reason: string;
  profile_url: string | null;
  created_at: string;
  decided_at: string | null;
  decision_note: string | null;
};

export type ResearcherAccess = {
  role: "user" | "researcher" | "admin";
  access_status: ResearcherAccessStatus;
  can_request: boolean;
  requests: ResearcherRequestOwn[];
};

export type AdminResearcherRequest = {
  id: string;
  status: ResearcherRequestStatus;
  applicant: {
    id: string;
    email: string;
    display_name: string | null;
    role: "user" | "researcher" | "admin";
  };
  institution: string;
  research_area: string;
  designation: string | null;
  created_at: string;
};

export type AdminResearcherDecisionRecord = {
  id: string;
  status: ResearcherRequestStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
};

export type AdminResearcherRequestDetail = AdminResearcherRequest & {
  reason: string;
  profile_url: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  other_requests: AdminResearcherDecisionRecord[];
};

export type SubmissionItem = {
  type: "document" | "dataset";
  id: string;
  title: string;
  file_type: string | null;
  verification_status: string;
  created_at: string;
  href: string;
};

