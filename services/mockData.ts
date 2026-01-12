
import { 
  UserRole, MemberStatus, DueType, BillingFrequency, PaymentStatus, ExpenseStatus,
  Member, LedgerEntry, Payment, Expense, DueConfig, AuditLog 
} from '../types';

export const MOCK_MEMBERS: Member[] = [
  {
    id: 'm1',
    membershipId: '02-381',
    email: 'president@unit48.org',
    phone: '08012345678',
    fullName: 'Chief Babatunde Okafor',
    dateOfJoining: '2020-01-01',
    status: MemberStatus.ACTIVE,
    role: UserRole.MEMBER,
    balance: 50000.00,
    password: 'Admin123',
    address: '123 Presidential Way, Lagos',
    dob: '1970-05-15'
  },
  {
    id: 'm2',
    membershipId: 'U48-042',
    email: 'member1@example.com',
    phone: '08122334455',
    fullName: 'Alice Johnson',
    dateOfJoining: '2024-03-15',
    status: MemberStatus.ACTIVE,
    role: UserRole.MEMBER,
    balance: -438.71,
    password: 'Admin123',
    address: '42 Circle Drive, Abuja',
    dob: '1995-08-22'
  },
  {
    id: 'm3',
    membershipId: 'U48-089',
    email: 'auditor@unit48.org',
    phone: '09088776655',
    fullName: 'Samuel Adebayo',
    dateOfJoining: '2022-06-10',
    status: MemberStatus.ACTIVE,
    role: UserRole.AUDITOR,
    balance: 0,
    password: 'Admin123',
    address: '89 Audit Lane, Ibadan',
    dob: '1982-12-01'
  },
  {
    id: 'm4',
    membershipId: 'U48-015',
    email: 'admin@unit48.org',
    phone: '07033445566',
    fullName: 'Grace Olayinka',
    dateOfJoining: '2021-11-20',
    status: MemberStatus.ACTIVE,
    role: UserRole.ADMIN,
    balance: 1500.00,
    password: 'Admin123',
    address: '15 Admin Street, Port Harcourt',
    dob: '1988-03-30'
  },
  {
    id: 'm5',
    membershipId: '02-15104',
    email: 'adedayo@example.com',
    phone: '08000000001',
    fullName: 'ABHADEMERE Adedayo',
    dateOfJoining: '2025-01-01',
    status: MemberStatus.ACTIVE,
    role: UserRole.MEMBER,
    balance: 0,
    password: 'Admin123',
    address: 'Unit 48 Block A',
    dob: '1985-01-01'
  },
  {
    id: 'm6',
    membershipId: '02-11569',
    email: 'adebisi@example.com',
    phone: '08000000002',
    fullName: 'ADEBISI A O',
    dateOfJoining: '2025-01-01',
    status: MemberStatus.ACTIVE,
    role: UserRole.MEMBER,
    balance: 0,
    password: 'Admin123',
    address: 'Unit 48 Block B',
    dob: '1982-02-02'
  },
  {
    id: 'm7',
    membershipId: '02-15775',
    email: 'adeboye@example.com',
    phone: '08000000003',
    fullName: 'Adeboye Adebisi',
    dateOfJoining: '2025-01-01',
    status: MemberStatus.ACTIVE,
    role: UserRole.MEMBER,
    balance: 0,
    password: 'Admin123',
    address: 'Unit 48 Block C',
    dob: '1988-03-03'
  },
  {
    id: 'm8',
    membershipId: '02-11575',
    email: 'adeniji@example.com',
    phone: '08000000004',
    fullName: 'ADENIJI Sunday O',
    dateOfJoining: '2025-01-01',
    status: MemberStatus.ACTIVE,
    role: UserRole.MEMBER,
    balance: 0,
    password: 'Admin123',
    address: 'Unit 48 Block D',
    dob: '1980-04-04'
  },
  {
    id: 'm9',
    membershipId: '02-14380',
    email: 'adeyelu@example.com',
    phone: '08000000005',
    fullName: 'ADEYELU Funsho S',
    dateOfJoining: '2025-01-01',
    status: MemberStatus.ACTIVE,
    role: UserRole.MEMBER,
    balance: 0,
    password: 'Admin123',
    address: 'Unit 48 Block E',
    dob: '1984-05-05'
  },
  {
    id: 'm10',
    membershipId: '02-15465',
    email: 'adeyemi@example.com',
    phone: '08000000006',
    fullName: 'ADEYEMI Ojo Oloruntoba',
    dateOfJoining: '2025-01-01',
    status: MemberStatus.ACTIVE,
    role: UserRole.MEMBER,
    balance: 0,
    password: 'Admin123',
    address: 'Unit 48 Block F',
    dob: '1986-06-06'
  },
  {
    id: 'm11',
    membershipId: '02-15105',
    email: 'adjamah@example.com',
    phone: '08000000007',
    fullName: 'ADJAMAH Idowu',
    dateOfJoining: '2025-01-01',
    status: MemberStatus.ACTIVE,
    role: UserRole.MEMBER,
    balance: 0,
    password: 'Admin123',
    address: 'Unit 48 Block G',
    dob: '1981-07-07'
  },
  {
    id: 'm12',
    membershipId: '02-15612',
    email: 'akawo@example.com',
    phone: '08000000008',
    fullName: 'AKAWO CHUKS',
    dateOfJoining: '2025-01-01',
    status: MemberStatus.ACTIVE,
    role: UserRole.MEMBER,
    balance: 0,
    password: 'Admin123',
    address: 'Unit 48 Block H',
    dob: '1983-08-08'
  },
  {
    id: 'm13',
    membershipId: '02-15103',
    email: 'akinseloyin@example.com',
    phone: '08000000009',
    fullName: 'AKINSELOYIN Mariam Mrs',
    dateOfJoining: '2025-01-01',
    status: MemberStatus.ACTIVE,
    role: UserRole.MEMBER,
    balance: 0,
    password: 'Admin123',
    address: 'Unit 48 Block I',
    dob: '1987-09-09'
  },
  {
    id: 'm14',
    membershipId: '02-14381',
    email: 'ogbaisi@example.com',
    phone: '08000000010',
    fullName: 'OGBAISI Chris O',
    dateOfJoining: '2025-01-01',
    status: MemberStatus.ACTIVE,
    role: UserRole.SUPER_ADMIN,
    balance: 0,
    password: 'Admin123',
    address: 'Unit 48 Block J',
    dob: '1989-10-10'
  }
];

export const MOCK_DUES_CONFIG: DueConfig[] = [
  {
    id: 'd1',
    dueType: DueType.NATIONAL,
    billingFrequency: BillingFrequency.ANNUAL,
    amount: 10000,
    effectiveStartDate: '2026-01-01'
  },
  {
    id: 'd2',
    dueType: DueType.UNIT,
    billingFrequency: BillingFrequency.MONTHLY,
    amount: 500,
    effectiveStartDate: '2026-01-01'
  },
  {
    id: 'd3',
    dueType: DueType.WELFARE,
    billingFrequency: BillingFrequency.MONTHLY,
    amount: 300,
    effectiveStartDate: '2026-01-01'
  },
  {
    id: 'd4',
    dueType: DueType.DEVELOPMENT,
    billingFrequency: BillingFrequency.ANNUAL,
    amount: 2000,
    effectiveStartDate: '2026-01-01'
  }
];

export const MOCK_LEDGER: LedgerEntry[] = [
  {
    id: 'l1',
    entryDate: '2026-01-01',
    effectiveDate: '2026-01-01',
    description: 'Annual National Due - 2026',
    debitAccountId: 'acc-member-receivable',
    creditAccountId: 'acc-revenue-national',
    amount: 10000,
    memberId: 'm1',
    referenceType: 'AUTO_DEBIT_BATCH',
    referenceId: 'b1',
    createdAt: '2026-01-01T00:10:00Z'
  },
  {
    id: 'l2',
    entryDate: '2026-01-10',
    effectiveDate: '2026-01-10',
    description: 'Bank Transfer Payment - Ref: TRNX9988',
    debitAccountId: 'acc-bank',
    creditAccountId: 'acc-member-receivable',
    amount: 60000,
    memberId: 'm1',
    referenceType: 'PAYMENT',
    referenceId: 'p1',
    createdAt: '2026-01-10T14:30:00Z'
  }
];

export const MOCK_PAYMENTS: Payment[] = [
  {
    id: 'p1',
    memberId: 'm1',
    memberName: 'Chief Babatunde Okafor',
    amount: 60000,
    paymentDate: '2026-01-10',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'TRNX9988',
    status: PaymentStatus.VERIFIED,
    createdAt: '2026-01-10T14:25:00Z'
  },
  {
    id: 'p2',
    memberId: 'm2',
    memberName: 'Alice Johnson',
    amount: 5000,
    paymentDate: '2026-01-12',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'ALICE-001',
    status: PaymentStatus.PENDING,
    createdAt: '2026-01-12T09:15:00Z'
  }
];

export const MOCK_EXPENSES: Expense[] = [
  {
    id: 'e1',
    title: 'Stationery for General Meeting',
    description: 'Printed reports and pens for 50 attendees',
    category: 'ADMINISTRATIVE',
    amount: 12500,
    incurredDate: '2026-01-05',
    submittedBy: 'm1',
    status: ExpenseStatus.APPROVED,
    createdAt: '2026-01-06T11:00:00Z'
  },
  {
    id: 'e2',
    title: 'Refreshments for Elders Committee',
    description: 'Water and snacks',
    category: 'HOSPITALITY',
    amount: 5000,
    incurredDate: '2026-01-11',
    submittedBy: 'm4',
    status: ExpenseStatus.UNDER_REVIEW,
    createdAt: '2026-01-11T16:45:00Z'
  }
];

export const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'a1',
    userId: 'm1',
    userName: 'Chief Babatunde Okafor',
    action: 'CREATE_DUE_CONFIG',
    entityType: 'DUES_CONFIG',
    entityId: 'd1',
    timestamp: '2026-01-01T08:00:00Z',
    ipAddress: '192.168.1.1'
  },
  {
    id: 'a2',
    userId: 'm4',
    userName: 'Grace Olayinka',
    action: 'VERIFY_PAYMENT',
    entityType: 'PAYMENT',
    entityId: 'p1',
    timestamp: '2026-01-10T14:30:00Z',
    ipAddress: '192.168.1.4'
  }
];
