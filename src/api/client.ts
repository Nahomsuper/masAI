import type {
  AuthResponse,
  Crop,
  CropLibraryItem,
  CropView,
  DailyRecord,
  DashboardData,
  DemoResponse,
  HealthResponse,
  Scan,
  ScanResult,
} from '../types';
import { getStoredLanguage } from '../lib/prefs';

export const TOKEN_KEY = 'masai.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type JsonRecord = Record<string, unknown>;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-MasAI-Language', getStoredLanguage());
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Could not reach MasAI. Check that the API server is running.', 'network_error');
  }

  const payload = (await response.json().catch(() => null)) as JsonRecord | null;
  if (!response.ok) {
    const message = String(payload?.error ?? payload?.message ?? `Request failed (${response.status})`);
    throw new ApiError(
      response.status,
      message,
      String(payload?.code ?? 'error'),
      payload?.details,
    );
  }
  return payload as T;
}

const jsonBody = (data: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(data),
});

export interface CropInput {
  name: string;
  variety?: string | null;
  fieldName?: string | null;
  areaSqm?: number | null;
  plantedAt: string;
  notes?: string | null;
}

export interface RecordInput {
  recordDate: string;
  waterLiters?: number | null;
  growthCm?: number | null;
  leafColour?: string | null;
  soilMoisture?: string | null;
  pestsSeen?: string | null;
  notes?: string | null;
  image?: string | null;
}

export interface ScanInput {
  image: string;
  cropId?: number | null;
  cropHint?: string | null;
  note?: string | null;
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  demoPreview: () =>
    request<{
      available: boolean;
      aiConfigured: boolean;
      crops: { name: string; variety: string; fieldName: string; plantedDaysAgo: number; condition: string }[];
    }>('/demo'),
  demoStart: () => request<DemoResponse>('/demo/start', jsonBody({})),

  register: (data: { name: string; phone: string; pin: string; region?: string }) =>
    request<AuthResponse>('/auth/register', jsonBody(data)),
  login: (data: { phone: string; pin: string }) => request<AuthResponse>('/auth/login', jsonBody(data)),
  me: () => request<{ farmer: AuthResponse['farmer'] }>('/auth/me'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  dashboard: () => request<DashboardData>('/dashboard'),
  library: () => request<{ crops: CropLibraryItem[] }>('/crops/library'),
  crops: () => request<{ crops: CropView[] }>('/crops'),
  crop: (id: number) => request<CropView>(`/crops/${id}`),
  createCrop: (data: CropInput) => request<CropView>('/crops', jsonBody(data)),
  updateCrop: (id: number, data: Partial<CropInput> & { status?: Crop['status'] }) =>
    request<CropView>(`/crops/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCrop: (id: number) => request<{ ok: boolean }>(`/crops/${id}`, { method: 'DELETE' }),
  replanCrop: (id: number) => request<CropView>(`/crops/${id}/replan`, jsonBody({})),
  planPreview: (data: Partial<CropInput> & { name: string }) =>
    request<{ plan: Partial<CropView['crop']['plan']>; source: string; warning: string | null }>(
      '/crops/plan-preview',
      jsonBody(data),
    ),

  records: (cropId: number) =>
    request<{ records: DailyRecord[]; prediction: CropView['prediction'] }>(
      `/records/crops/${cropId}/records`,
    ),
  createRecord: (cropId: number, data: RecordInput) => request<CropView>(`/records/crops/${cropId}/records`, jsonBody(data)),
  deleteRecord: (cropId: number, recordId: number) =>
    request<CropView>(`/records/crops/${cropId}/records/${recordId}`, { method: 'DELETE' }),

  scans: () => request<{ scans: Scan[] }>('/scans'),
  createScan: (data: ScanInput) => request<ScanResult>('/scans', jsonBody(data)),
  deleteScan: (id: number) => request<{ ok: boolean }>(`/scans/${id}`, { method: 'DELETE' }),
  attachScan: (id: number, cropId: number) =>
    request<CropView & { scan: Scan }>(`/scans/${id}/attach`, jsonBody({ cropId })),
};
