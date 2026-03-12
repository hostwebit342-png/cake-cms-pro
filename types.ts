
export enum UserRole {
  SP_SUPERVISOR = 'SP Supervisor',
  SP_HOD = 'SP HOD',
  PRODUCTION_MANAGER = 'Production Manager',
  ADMIN = 'Admin',
  BMS_USER = 'BMS User'
}

export enum OrderStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
  DONE = 'Done',
  RETURNED = 'Returned'
}

export enum OrderPriority {
  NORMAL = 'Normal',
  URGENT = 'Urgent'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  department: 'SP' | 'BMS' | 'MANAGEMENT';
}

export interface Order {
  id: string;
  flavour: string;
  quantityKg: number;
  quantityGr: number;
  formattedQuantity: string;
  placedBy: string;
  timestamp: string;
  status: OrderStatus;
  priority: OrderPriority;
  returnReason?: string;
  completedAt?: string;
  cancelledAt?: string;
  doneAt?: string;
}
