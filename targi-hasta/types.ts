export interface TradeOrder {
  id: string;
  clientName: string;
  orderValue: number;
  ticketNumber: string;
  createdAt: number; // timestamp
  isWinner: boolean;
  createdBy?: string; // Store which exhibitor created it (Name)
  exhibitorId?: string; // Store exhibitor ID for filtering
}

export enum AppView {
  LANDING = 'LANDING',
  LOGIN_ADMIN = 'LOGIN_ADMIN',
  LOGIN_EXHIBITOR = 'LOGIN_EXHIBITOR',
  EXHIBITOR = 'EXHIBITOR',
  ADMIN = 'ADMIN',
  LOTTERY = 'LOTTERY'
}

export interface WinnerContext {
  winner: TradeOrder;
  congratulationMessage?: string;
}

export interface ExhibitorAccount {
  id: string;
  name: string;
  accessCode: string;
  boothNumber?: string;
  createdAt?: number;
  count?: number;
  totalValue?: number;
}

export interface UserSession {
  role: 'ADMIN' | 'EXHIBITOR' | 'SUPERUSER';
  name: string;
  id?: string;
  token?: string;
  accessCode?: string;
  boothNumber?: string;
}

export interface SystemStats {
  totalOrders: number;
  totalValue: number;
  eligibleCount: number;
  winnersCount: number;
  exhibitorsCount: number;
  exhibitorRanking: Array<{
    id: string;
    name: string;
    boothNumber: string;
    accessCode: string;
    count: number;
    totalValue: number;
  }>;
  clientRanking: Array<{
    name: string;
    count: number;
    totalValue: number;
  }>;
}

export interface ServerHealth {
  status: string;
  version: string;
  uptime: number;
  timestamp: number;
  sseClientsCount?: number;
}
