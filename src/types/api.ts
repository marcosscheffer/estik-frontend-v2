// Tipos espelhando os schemas do OpenAPI do estik-API (v1).

export type UUID = string;
export type ISODate = string;

/** Hierarquia do backend: ADMINISTRATOR > TECHNICIAN > REGULATOR > USER. */
export type Role = "USER" | "REGULATOR" | "TECHNICIAN" | "ADMINISTRATOR";
/** Área de atuação do usuário (campo `function`). */
export type UserFunction = "IT" | "MAINTENANCE" | "USER";
export type TicketStatus = "OPEN" | "FORWARDED" | "PROGRESS" | "CANCELLED" | "RESOLVED";
export type TicketPriority = "MILD" | "MODERATE" | "URGENT";
export type TicketType = "IT" | "MAINTENANCE";
export type OsType = "UBUNTU" | "WINDOWS";
export type StorageType = "NVME" | "SSD" | "HDD";
export type Direction = "RECEIVED" | "SENT" | "NONE";
export type MovementType = "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT";

/** Paginação padrão do backend (PageResult). */
export interface PageResult<T> {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

/** /users usa PageResponse, com "content" em vez de "items" (o service normaliza para PageResult). */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface PageParams {
  page?: number;
  size?: number;
}

export interface ErrorResponse {
  timestamp?: ISODate;
  status: number;
  error?: string;
  message?: string;
  path?: string;
  fields?: Record<string, string>;
}

/* ---------- Resumos reutilizados ---------- */
export interface RefSummary {
  id: UUID;
  name: string;
  code: string;
}

/* ---------- Auth ---------- */
export interface LoginRequest {
  username: string;
  password: string;
}
export interface RegisterRequest {
  email?: string;
  username: string;
  password: string;
  /** Opcional: a unidade é definida pelo administrador ao ativar a conta. */
  facilityId?: UUID;
}
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}
export interface UserAuthResponse {
  id: UUID;
  username: string;
  email?: string;
  facilityId: UUID;
  createdAt: ISODate;
  updatedAt: ISODate;
  active: boolean;
}

/* ---------- Users ---------- */
export interface UserResponse {
  id: UUID;
  username: string;
  email?: string;
  /** Pode vir vazio até o administrador definir a unidade. */
  facilityId?: UUID | null;
  function: UserFunction;
  role: Role;
  createdAt: ISODate;
  updatedAt: ISODate;
  active: boolean;
}
export interface UserResponseSummary {
  id: UUID;
  username: string;
  email?: string;
  function: UserFunction;
  role: Role;
  active: boolean;
}
export interface UpdateUserRequest {
  email?: string;
  username: string;
}

/* ---------- Facilities ---------- */
export type FacilitySummaryResponse = RefSummary;
export interface FacilityResponse extends RefSummary {
  createdAt: ISODate;
  updatedAt: ISODate;
}
export interface FacilityRequest {
  name: string;
  code: string;
}

/* ---------- Departaments ---------- */
export interface DepartamentSummaryResponse extends RefSummary {
  facility: RefSummary;
}
export interface DepartamentResponse extends DepartamentSummaryResponse {
  createdAt: ISODate;
  updatedAt: ISODate;
}
export interface CreateDepartamentRequest {
  facilityId: UUID;
  name: string;
  code: string;
}
export interface UpdateDepartamentRequest {
  name: string;
  code: string;
}

/* ---------- Computers ---------- */
export interface ComputerSummaryResponse {
  id: UUID;
  name: string;
  departament: RefSummary;
  facility: RefSummary;
  createdAt: ISODate;
  updatedAt: ISODate;
}
export interface ComputerResponse {
  id: UUID;
  name: string;
  cpu: string;
  ram: string;
  os: OsType;
  storageType: StorageType;
  storage: string;
  facility: RefSummary;
  departament: RefSummary;
  createdAt: ISODate;
  updatedAt: ISODate;
}
export interface CreateComputerRequest {
  name: string;
  cpu: string;
  ram: string;
  os: OsType;
  storageType: StorageType;
  storage: string;
  facilityId: UUID;
  departamentId: UUID;
}
export interface UpdateComputerRequest {
  cpu: string;
  ram: string;
  os: OsType;
  storageType: StorageType;
  storage: string;
  serviceDescription: string;
  direction: Direction;
}
export interface MoveComputerRequest {
  facilityId: UUID;
  departamentId: UUID;
  serviceDescription: string;
  direction: Direction;
}

/* ---------- Computer histories ---------- */
/** Computador resumido dentro do histórico. updatedAt é do computador, não do registro. */
export interface ComputerHistoryComputerResponse {
  id: UUID;
  name: string;
  updatedAt?: ISODate;
}
export interface ComputerHistorySummaryResponse {
  id: UUID;
  serviceDescription: string;
  computer?: ComputerHistoryComputerResponse | null;
  direction: Direction;
}
export interface ComputerHistoryResponse extends ComputerHistorySummaryResponse {
  departamentId: UUID;
  createdAt: ISODate;
}

/* ---------- Tickets ---------- */
export interface TicketUserResponse {
  id: UUID;
  username: string;
}
export interface TicketSummaryResponse {
  id: UUID;
  facility: RefSummary;
  title: string;
  ticketType: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: ISODate;
}
export interface TicketResponse {
  id: UUID;
  /** Chat criado quando o técnico assume; null até lá. */
  chatId?: UUID | null;
  facility: RefSummary;
  requester: TicketUserResponse;
  /** Técnico para quem foi encaminhado (só ele pode assumir). */
  forwarded?: TicketUserResponse | null;
  /** Quem encaminhou. */
  regulator?: TicketUserResponse | null;
  assignee?: TicketUserResponse | null;
  ticketType: TicketType;
  title: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: ISODate;
  updatedAt: ISODate;
}
export interface CreateTicketRequest {
  title: string;
  description?: string;
  facilityId: UUID;
  ticketType: TicketType;
  priority: TicketPriority;
}
export interface UpdateTicketRequest {
  title: string;
  description: string;
  ticketType: TicketType;
}
/** POST /tickets/{id}/forward — userId precisa ser TECHNICIAN ou ADMINISTRATOR (e não o solicitante). */
export interface ForwardTicketRequest {
  userId: UUID;
  priority: TicketPriority;
}
export interface TicketHistoryResponse {
  id: UUID;
  status: TicketStatus;
  type: TicketType;
  createdAt: ISODate;
}

/* ---------- Chat ---------- */
export interface ChatUserResponse {
  id: UUID;
  username: string;
  email?: string;
}
/** Participante do chat: `id` é o id do participante, o usuário está em `userId`. */
export interface ChatParticipantResponse {
  id: UUID;
  userId: ChatUserResponse;
  joinedAt?: ISODate;
}
export interface ChatFileResponse {
  id: UUID;
  /** Relativo à API ("/files/{id}?expires=..&signature=.."), público e válido por 1h. */
  fileUrl: string;
  fileType: string;
}
export interface ChatAttachmentResponse {
  id: UUID;
  file: ChatFileResponse;
}
export interface ChatReplyResponse {
  id: UUID;
  content: string;
  createdAt: ISODate;
  updatedAt?: ISODate;
}
/** GET/POST /chats/{chatId}/messages (a lista vem sem ordem garantida). */
export interface MessageResponse {
  id: UUID;
  sender: ChatParticipantResponse;
  attachments?: ChatAttachmentResponse[] | null;
  replyTo?: ChatReplyResponse | null;
  content: string;
  createdAt: ISODate;
  updatedAt?: ISODate;
}
/** Evento "message" do SSE /chats/{chatId}/stream. */
export interface ChatStreamPayload extends MessageResponse {
  chatId: UUID;
}
export interface SendMessageRequest {
  content: string;
  replyToId?: UUID;
}

/* ---------- Categories ---------- */
export interface CategorySummaryResponse {
  id: UUID;
  name: string;
}
export interface CategoryResponse extends CategorySummaryResponse {
  description?: string;
}
export interface CategoryRequest {
  name?: string;
  description?: string;
}

/* ---------- Items ---------- */
export interface ItemSummaryResponse {
  id: UUID;
  name: string;
  sku: string;
}
export interface ItemResponse extends ItemSummaryResponse {
  description?: string;
  minimum: number;
  categoryId: UUID;
  createdAt: ISODate;
  updatedAt: ISODate;
}
export interface ItemRequest {
  name: string;
  description: string;
  sku: string;
  minimum: number;
  categoryId: UUID;
}

/* ---------- Stock ---------- */
export interface StockItemResponse {
  id: UUID;
  name: string;
  sku: string;
}
export interface StockBalanceSummaryResponse {
  id: UUID;
  item: StockItemResponse;
  facility: RefSummary;
  quantity: number;
}
export interface StockBalanceResponse extends StockBalanceSummaryResponse {
  departament: RefSummary;
  updatedAt: ISODate;
}
export interface StockMovementSummaryResponse {
  id: UUID;
  type: MovementType;
  facilitySource?: RefSummary | null;
  facilityDestination?: RefSummary | null;
  item: StockItemResponse;
  quantity: number;
  createdAt: ISODate;
  departamentSource?: RefSummary | null;
  departamentDestination?: RefSummary | null;
}
export interface StockMovementResponse extends StockMovementSummaryResponse {
  description?: string;
}
export interface MovementRequest {
  facilityId: UUID;
  departamentId: UUID;
  itemId: UUID;
  quantity: number;
  description?: string;
}
export interface TransferRequest {
  stockBalanceId: UUID;
  facilityDestinationId: UUID;
  departamentDestinationId: UUID;
  itemId: UUID;
  quantity: number;
  description?: string;
}

/* ---------- Notifications ---------- */
/** Tipos gravados pelo TicketEventListener (encaminhar ainda não notifica). */
export type NotificationType =
  | "NEW_TICKET"
  | "TICKET_ASSUMED"
  | "TICKET_REOPEN"
  | "TICKET_CANCELLED"
  | "TICKET_RESOLVED";
export interface NotificationResponse {
  id: UUID;
  title: string;
  message: string;
  read: boolean;
  /** O backend manda string livre; os conhecidos estão em NotificationType. */
  type: NotificationType | (string & {});
  /** id do chamado relacionado */
  referencesId?: UUID | null;
  createdAt: ISODate;
}
/** Evento "notification" do SSE /notifications/stream. */
export interface NotificationStreamPayload {
  id: UUID;
  type: NotificationType | (string & {});
  title: string;
  message: string;
  referencesId?: UUID | null;
  createdAt: ISODate;
}
export interface UnreadNotificationsResponse {
  quantity: number;
}
