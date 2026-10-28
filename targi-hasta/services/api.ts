import { TradeOrder, ExhibitorAccount, UserSession, SystemStats, ServerHealth } from '../types';

const TOKEN_KEY = 'fair_auth_token';

// Określenie adresu URL API
const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Jeśli pracujemy w środowisku dev z proxy vite lub ten sam host
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // W Vite proxy kieruje /api na http://localhost:3001
      return '/api';
    }
  }
  return '/api';
};

class ApiService {
  private token: string | null = null;
  private isConnected = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_KEY);
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      this.isConnected = true;

      if (!response.ok) {
        let errorMsg = `Błąd serwera (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      return await response.json() as T;
    } catch (err: any) {
      // Jeśli błąd połączenia
      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
        this.isConnected = false;
      }
      throw err;
    }
  }

  // --- Status i diagnostyka ---
  async checkHealth(): Promise<ServerHealth | null> {
    try {
      const health = await this.request<ServerHealth>('/health');
      this.isConnected = true;
      return health;
    } catch {
      this.isConnected = false;
      return null;
    }
  }

  // --- Autoryzacja ---
  async loginAdmin(password: string): Promise<UserSession> {
    const res = await this.request<{ session: UserSession }>('/auth/login-admin', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    if (res.session.token) {
      this.setToken(res.session.token);
    }
    return res.session;
  }

  async loginExhibitor(accessCode: string): Promise<UserSession> {
    const res = await this.request<{ session: UserSession }>('/auth/login-exhibitor', {
      method: 'POST',
      body: JSON.stringify({ accessCode: accessCode.trim().toUpperCase() })
    });
    if (res.session.token) {
      this.setToken(res.session.token);
    }
    return res.session;
  }

  async getMe(): Promise<UserSession | null> {
    if (!this.token) return null;
    try {
      const res = await this.request<{ session: UserSession }>('/auth/me');
      return res.session;
    } catch {
      this.setToken(null);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      this.setToken(null);
    }
  }

  // --- Dostawcy (Exhibitors) ---
  async getExhibitors(): Promise<ExhibitorAccount[]> {
    const res = await this.request<{ exhibitors: ExhibitorAccount[] }>('/exhibitors');
    return res.exhibitors;
  }

  async createExhibitor(name: string, boothNumber?: string, customCode?: string): Promise<ExhibitorAccount> {
    const res = await this.request<{ exhibitor: ExhibitorAccount }>('/exhibitors', {
      method: 'POST',
      body: JSON.stringify({ name, boothNumber, customCode })
    });
    return res.exhibitor;
  }

  async updateExhibitor(id: string, updates: { name?: string; boothNumber?: string; regenerateCode?: boolean }): Promise<ExhibitorAccount> {
    const res = await this.request<{ exhibitor: ExhibitorAccount }>(`/exhibitors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return res.exhibitor;
  }

  async deleteExhibitor(id: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/exhibitors/${id}`, {
      method: 'DELETE'
    });
    return res.success;
  }

  // --- Zamówienia (Orders) ---
  async getOrders(): Promise<TradeOrder[]> {
    const res = await this.request<{ orders: TradeOrder[] }>('/orders');
    return res.orders;
  }

  async createOrder(clientName: string, orderValue: number): Promise<TradeOrder> {
    const res = await this.request<{ order: TradeOrder }>('/orders', {
      method: 'POST',
      body: JSON.stringify({ clientName, orderValue })
    });
    return res.order;
  }

  async deleteOrder(id: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>(`/orders/${id}`, {
      method: 'DELETE'
    });
    return res.success;
  }

  async markOrderAsWinner(id: string): Promise<TradeOrder> {
    const res = await this.request<{ order: TradeOrder }>(`/orders/${id}/win`, {
      method: 'POST'
    });
    return res.order;
  }

  // --- Statystyki i Raporty ---
  async getStats(): Promise<SystemStats> {
    const res = await this.request<{ stats: SystemStats }>('/stats');
    return res.stats;
  }

  async downloadCSV(): Promise<void> {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/export/csv`;
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Nie udało się wyeksportować CSV');
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `raport_targi_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }

  // --- Kopia zapasowa i reset ---
  async downloadBackup(): Promise<void> {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/backup`;
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Nie udało się pobrać backupu');
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `backup_targi_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }

  async restoreBackup(backupData: any): Promise<any> {
    return await this.request('/backup', {
      method: 'POST',
      body: JSON.stringify(backupData)
    });
  }

  async clearAllOrders(): Promise<number> {
    const res = await this.request<{ success: boolean; clearedCount: number }>('/admin/clear-data', {
      method: 'POST'
    });
    return res.clearedCount;
  }

  async updateAdminPassword(newPassword: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>('/admin/password', {
      method: 'PUT',
      body: JSON.stringify({ newPassword })
    });
    return res.success;
  }

  // --- Zarządzanie Integracją ERP ---
  async getErpApiKey(): Promise<string> {
    const res = await this.request<{ erpApiKey: string }>('/admin/erp-key');
    return res.erpApiKey;
  }

  async regenerateErpApiKey(): Promise<string> {
    const res = await this.request<{ erpApiKey: string }>('/admin/erp-key', {
      method: 'POST'
    });
    return res.erpApiKey;
  }

  async getErpSummary(): Promise<any> {
    const res = await this.request('/erp/summary');
    return res;
  }

  // --- Server-Sent Events (Live Push) ---
  subscribeEvents(onMessage: (event: { type: string; payload: any }) => void): () => void {
    const baseUrl = getApiBaseUrl();
    const eventSource = new EventSource(`${baseUrl}/events`);

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onMessage(parsed);
      } catch {
        // ignore parse error or comment
      }
    };

    eventSource.onerror = () => {
      // Automatyczny reconnect jest wbudowany w EventSource
    };

    return () => {
      eventSource.close();
    };
  }
}

export const api = new ApiService();
