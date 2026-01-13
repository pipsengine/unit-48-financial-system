
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  AUDITOR = 'AUDITOR'
}

export enum MemberStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED'
}

export enum DueType {
  NATIONAL = 'NATIONAL',
  UNIT = 'UNIT',
  WELFARE = 'WELFARE',
  DEVELOPMENT = 'DEVELOPMENT'
}

export enum BillingFrequency {
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL'
}

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  REVERSED = 'REVERSED'
}

export enum ExpenseStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

export interface Member {
  id: string;
  membershipId: string;
  email: string;
  phone: string;
  fullName: string;
  dateOfJoining: string;
  status: MemberStatus;
  role: UserRole;
  balance: number;
  arrearsBalance?: number;
  previousBalance?: number;
  password?: string;
  address?: string;
  dob?: string;
}

export enum LedgerCategory {
  NATIONAL_DUE = 'NATIONAL_DUE',
  UNIT_DUE = 'UNIT_DUE',
  WELFARE_DUE = 'WELFARE_DUE',
  DEVELOPMENT_LEVY = 'DEVELOPMENT_LEVY',
  COMMAND_REFRESHMENT = 'COMMAND_REFRESHMENT',
  PROJECT_SUPPORT = 'PROJECT_SUPPORT',
  DONATION = 'DONATION',
  OUTSTANDING_ARREARS = 'OUTSTANDING_ARREARS'
}

export enum PostingType {
  OPENING_BALANCE = 'OPENING_BALANCE',
  CURRENT_YEAR_CHARGE = 'CURRENT_YEAR_CHARGE',
  ARREARS_CHARGE = 'ARREARS_CHARGE',
  PAYMENT = 'PAYMENT',
  ARREARS_SETTLEMENT = 'ARREARS_SETTLEMENT',
  DONATION = 'DONATION',
  ADJUSTMENT = 'ADJUSTMENT',
  REVERSAL = 'REVERSAL',
  EXPENSE = 'EXPENSE',
  FUND_RECOGNITION = 'FUND_RECOGNITION'
}

export enum LedgerStatus {
  POSTED = 'POSTED',
  PENDING = 'PENDING',
  VOID = 'VOID'
}

export interface LedgerEntry {
  id: string;
  entryDate: string;
  effectiveDate: string;
  description: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
  memberId?: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
  appliedFinancialYear: number;
  postingYear: number;
  postingType: PostingType;
  category: LedgerCategory | string;
  status: LedgerStatus;
  // Computed for UI
  balance?: number;
  displayYear?: number;
}

export interface Payment {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  paymentType?: string;
  referenceNumber: string;
  status: PaymentStatus;
  notes?: string;
  createdAt: string;
  appliedFinancialYear?: number;
  postingType?: PostingType;
  reversalReferenceId?: string;
  correctionReason?: string;
  correctedBy?: string;
  correctedAt?: string;
}

export interface Expense {
  id: string;
  title: string;
  description: string;
  category: string;
  amount: number;
  incurredDate: string;
  submittedBy: string;
  beneficiary?: string;
  status: ExpenseStatus;
  createdAt: string;
}

export interface DueConfig {
  id: string;
  dueType: DueType;
  billingFrequency: BillingFrequency;
  amount: number;
  effectiveStartDate: string;
  effectiveEndDate?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  ipAddress: string;
}
