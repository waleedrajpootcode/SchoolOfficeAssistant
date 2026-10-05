// Shared domain types for School Office Assistant.

/** Standard API response envelope */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Pagination parameters */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Auth / Users ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'teacher';

/** Safe user representation — never includes password_hash */
export interface UserSummary {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: UserSummary;
}

export interface CreateUserRequest {
  username: string;
  displayName: string;
  role: UserRole;
  password: string;
}

export interface UpdateUserRequest {
  displayName?: string;
  role?: UserRole;
  password?: string;
  isActive?: boolean;
}

// ─── Classes ─────────────────────────────────────────────────────────────────

export interface ClassSummary {
  id: number;
  name: string;
  section: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClassRequest {
  name: string;
  section?: string;
}

export interface UpdateClassRequest {
  name?: string;
  section?: string;
  isActive?: boolean;
}

// ─── Students ────────────────────────────────────────────────────────────────

export interface StudentSummary {
  id: number;
  rollNumber: string;
  fullName: string;
  guardianName: string;
  guardianPhone: string | null;
  classId: number;
  className: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentRequest {
  rollNumber: string;
  fullName: string;
  guardianName: string;
  guardianPhone?: string;
  classId: number;
  familyId?: number;
}

export interface UpdateStudentRequest {
  rollNumber?: string;
  fullName?: string;
  guardianName?: string;
  guardianPhone?: string;
  classId?: number;
  isActive?: boolean;
}

// ─── Teacher-Class assignments ────────────────────────────────────────────────

export interface TeacherClassAssignment {
  teacherId: number;
  teacherName: string;
  classId: number;
  className: string;
}

export interface CreateTeacherClassRequest {
  teacherId: number;
  classId: number;
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'absent' | 'leave';

export interface AttendanceRecord {
  id: number;
  studentId: number;
  studentName: string;
  rollNumber: string;
  attendanceDate: string;   // ISO date string YYYY-MM-DD
  status: AttendanceStatus;
  markedById: number;
  markedByName: string;
  createdAt: string;
  updatedAt: string;
}

/** Single entry within a bulk attendance submission */
export interface AttendanceEntry {
  studentId: number;
  status: AttendanceStatus;
}

/** POST /api/attendance — bulk submit for one class + date */
export interface SubmitAttendanceRequest {
  classId: number;
  attendanceDate: string;   // YYYY-MM-DD
  records: AttendanceEntry[];
}

/** Query params for GET /api/attendance */
export interface AttendanceQuery {
  classId: number;
  attendanceDate: string;
}
// ── Fees ─────────────────────────────────────────────────────────────────────

export type FeePaymentMethod = 'cash' | 'bank' | 'online' | 'other';

export type StudentFeeStatus = 'unpaid' | 'partial' | 'paid';

export interface FeeStructure {
  id: number;
  classId: number;
  className: string;
  feeName: string;
  amount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeStructureRequest {
  classId: number;
  feeName: string;
  amount: number;
}

export interface FeeRule {
  id: number;
  feeStructureId: number;
  feeName: string;
  className: string;
  lastDateDay: number | null;
  fineStartDay: number | null;
  fineAmount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeRuleRequest {
  feeStructureId: number;
  lastDateDay?: number;
  fineStartDay?: number;
  fineAmount?: number;
}

export interface UpdateFeeRuleRequest {
  lastDateDay?: number | null;
  fineStartDay?: number | null;
  fineAmount?: number;
  isActive?: boolean;
}

export interface StudentFee {
  id: number;
  studentId: number;
  studentName: string;
  rollNumber: string;
  feeStructureId: number | null;
  feePeriod: string;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  status: StudentFeeStatus;
  effectiveStatus: StudentFeeStatus | 'overdue';
  dueDate: string | null;
  fineStartDate: string | null;
  fineAmount: number;
  fineApplicable: boolean;
  appliedFine: number;
  fineWaived: boolean;
  fineWaivedAmount: number;
  fineWaivedReason: string | null;
  totalPayable: number;
  totalRemaining: number;
  daysOverdue: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentFeeRequest {
  studentId: number;
  feeStructureId: number;
  feePeriod: string;
  notes?: string;
}

export interface StudentFeeAssignment {
  id: number;
  studentId: number;
  studentName: string;
  rollNumber: string;
  classId: number;
  className: string;
  feeStructureId: number;
  feeName: string;
  structureAmount: number;
  amount: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentFeeAssignmentRequest {
  studentId: number;
  feeStructureId: number;
  amount?: number;
  effectiveFrom: string;
  notes?: string | null;
}

export interface UpdateStudentFeeAssignmentRequest {
  feeStructureId?: number;
  amount?: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isActive?: boolean;
  notes?: string | null;
}

export interface FeePayment {
  id: number;
  studentFeeId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: FeePaymentMethod;
  receivedBy: number;
  receivedByName: string;
  notes: string | null;
  createdAt: string;
}

export interface CreateFeePaymentRequest {
  studentFeeId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: FeePaymentMethod;
  notes?: string;
}

export interface StudentFeeDetails {
  fee: StudentFee;
  payments: FeePayment[];
}

export interface FeeSummary {
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  unpaidCount: number;
  partialCount: number;
  paidCount: number;
  overdueCount: number;
  overdueAmount: number;
}
export interface CreateFeePaymentRequest {
  studentFeeId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: FeePaymentMethod;
  notes?: string;
}

export interface FeePayment {
  id: number;
  studentFeeId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: FeePaymentMethod;
  receiptNumber: string;
  receivedBy: number;
  receivedByName: string;
  notes: string | null;
  createdAt: string;
}

export interface StudentFeeDetails {
  fee: StudentFee;
  payments: FeePayment[];
}

export interface FeeSummary {
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  unpaidCount: number;
  partialCount: number;
  paidCount: number;
}

export type TeacherSalaryStatus = 'pending' | 'partial' | 'paid';

export interface TeacherSalary {
  id: number;
  teacherId: number;
  teacherName: string;
  username: string;
  salaryPeriod: string;
  salaryDue: number;
  salaryPaid: number;
  salaryRemaining: number;
  status: TeacherSalaryStatus;
  paymentDate: string | null;
  paymentMethod: 'cash' | 'bank' | 'online' | 'other';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeacherSalaryRequest {
  teacherId: number;
  salaryPeriod: string;
  salaryDue: number;
  notes?: string;
}

export interface UpdateTeacherSalaryRequest {
  salaryPaid: number;
  paymentDate?: string;
  paymentMethod?: 'cash' | 'bank' | 'online' | 'other';
  notes?: string;
}


export interface TeacherProfile {
  teacherId: number;
  phone: string | null;
  email: string | null;
  subject: string | null;
  joiningDate: string | null;
  monthlySalary: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeacherProfileRequest {
  phone?: string;
  email?: string;
  subject?: string;
  joiningDate?: string;
  monthlySalary?: number;
  notes?: string;
}

export interface UpdateTeacherProfileRequest {
  phone?: string;
  email?: string;
  subject?: string;
  joiningDate?: string;
  monthlySalary?: number;
  notes?: string;
}
