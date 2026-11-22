import { z } from 'zod';

// ==========================================
// CONSTANTS
// ==========================================

export const EXPENSE_CATEGORIES = [
  'Food',
  'Groceries',
  'Shopping',
  'Travel',
  'Entertainment',
  'Education',
  'Health',
  'Bills',
  'Subscriptions',
  'Other',
] as const;

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Gift',
  'Other',
] as const;

export const PAYMENT_METHODS = ['upi', 'card', 'cash', 'bank', 'other'] as const;

export const PAPER_TYPES = ['blank', 'lined', 'dotted', 'grid', 'graph'] as const;

export const MODES = ['light', 'dark', 'system'] as const;

export const THEME_PALETTE_KEYS = [
  'bg',
  'surface',
  'primary',
  'secondary',
  'accent',
  'text',
  'border',
] as const;

export const DEFAULT_WIDGET_IDS = [
  'spend',
  'budget',
  'income',
  'savings',
  'trend',
  'notes',
  'stickies',
  'transactions',
] as const;

// Hex color regex
export const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// ==========================================
// COMMON SCHEMAS & TYPES
// ==========================================

export const HexColorSchema = z.string().regex(HEX_COLOR_REGEX, 'Must be a valid hex color code (e.g. #FFF or #FFFFFF)');

export const PaletteSchema = z.object({
  bg: HexColorSchema,
  surface: HexColorSchema,
  primary: HexColorSchema,
  secondary: HexColorSchema,
  accent: HexColorSchema,
  text: HexColorSchema,
  border: HexColorSchema,
});
export type Palette = z.infer<typeof PaletteSchema>;

export const WidgetItemSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
});
export type WidgetItem = z.infer<typeof WidgetItemSchema>;

export const NoteDefaultsSchema = z.object({
  fontFamily: z.string().default('sans'),
  fontSize: z.number().int().min(10).max(36).default(16),
  autosave: z.boolean().default(true),
  autosaveInterval: z.number().int().min(100).max(10000).default(800),
});
export type NoteDefaults = z.infer<typeof NoteDefaultsSchema>;

export const FinanceDefaultsSchema = z.object({
  currency: z.string().default('INR'),
  monthlyBudget: z.number().int().nonnegative().default(2500000), // in minor units (paise)
  enabledCategories: z.array(z.string()).default([...EXPENSE_CATEGORIES]),
});
export type FinanceDefaults = z.infer<typeof FinanceDefaultsSchema>;

// Standard Error Envelope
export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// ==========================================
// AUTH SCHEMAS
// ==========================================

export const RegisterInputSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters'),
  displayName: z.string().trim().min(1).max(100).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const ForgotPasswordInputSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long').max(128),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

export const VerifyEmailInputSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});
export type VerifyEmailInput = z.infer<typeof VerifyEmailInputSchema>;

export const UpdateMeInputSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  timeZone: z.string().optional(),
  currency: z.string().length(3).optional(),
  locale: z.string().optional(),
});
export type UpdateMeInput = z.infer<typeof UpdateMeInputSchema>;

export const DeleteAccountInputSchema = z.object({
  password: z.string().min(1, 'Password is required to confirm deletion'),
});
export type DeleteAccountInput = z.infer<typeof DeleteAccountInputSchema>;

// User Profile Public
export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  timeZone: z.string(),
  currency: z.string(),
  locale: z.string(),
  createdAt: z.string(),
  emailVerifiedAt: z.string().nullable(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// ==========================================
// PREFERENCES & THEMES SCHEMAS
// ==========================================

export const PreferencesSchema = z.object({
  themeId: z.string(),
  mode: z.enum(MODES),
  sidebarCollapsed: z.boolean(),
  dashboardWidgets: z.array(WidgetItemSchema),
  noteDefaults: NoteDefaultsSchema,
  financeDefaults: FinanceDefaultsSchema,
  onboardingCompletedAt: z.string().nullable(),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const UpdatePreferencesInputSchema = z.object({
  themeId: z.string().optional(),
  mode: z.enum(MODES).optional(),
  sidebarCollapsed: z.boolean().optional(),
  dashboardWidgets: z.array(WidgetItemSchema).optional(),
  noteDefaults: NoteDefaultsSchema.partial().optional(),
  financeDefaults: FinanceDefaultsSchema.partial().optional(),
  onboardingCompletedAt: z.string().nullable().optional(),
});
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesInputSchema>;

export const CustomThemeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(50),
  baseThemeId: z.string().nullable(),
  light: PaletteSchema,
  dark: PaletteSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CustomTheme = z.infer<typeof CustomThemeSchema>;

export const CreateCustomThemeInputSchema = z.object({
  name: z.string().trim().min(1, 'Theme name is required').max(50),
  baseThemeId: z.string().nullable().optional(),
  light: PaletteSchema,
  dark: PaletteSchema,
});
export type CreateCustomThemeInput = z.infer<typeof CreateCustomThemeInputSchema>;

export const UpdateCustomThemeInputSchema = CreateCustomThemeInputSchema.partial();
export type UpdateCustomThemeInput = z.infer<typeof UpdateCustomThemeInputSchema>;

// ==========================================
// NOTES & STICKIES & DRAWINGS SCHEMAS
// ==========================================

export const CreateNoteInputSchema = z.object({
  title: z.string().default('Untitled'),
  content: z.record(z.any()).default({ type: 'doc', content: [] }),
  collectionId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).default([]),
  fontFamily: z.string().optional(),
  fontSize: z.number().int().optional(),
  background: z.string().optional(),
  layout: z.string().optional(),
  isPinned: z.boolean().default(false),
  isFavorite: z.boolean().default(false),
  isArchived: z.boolean().default(false),
});
export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>;

export const UpdateNoteInputSchema = z.object({
  title: z.string().optional(),
  content: z.record(z.any()).optional(),
  collectionId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().int().optional(),
  background: z.string().optional(),
  layout: z.string().optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  version: z.number().int().optional(),
});
export type UpdateNoteInput = z.infer<typeof UpdateNoteInputSchema>;

export const CreateStickyInputSchema = z.object({
  boardId: z.string().optional(),
  text: z.string().default(''),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().default(200),
  height: z.number().default(200),
  rotation: z.number().default(0),
  zIndex: z.number().int().default(1),
  color: HexColorSchema.default('#FFF3B0'),
  fontFamily: z.string().default('sans'),
  fontSize: z.number().int().default(14),
  isPinned: z.boolean().default(false),
  pinnedToDashboard: z.boolean().default(false),
});
export type CreateStickyInput = z.infer<typeof CreateStickyInputSchema>;

export const UpdateStickyInputSchema = CreateStickyInputSchema.partial().extend({
  version: z.number().int().optional(),
});
export type UpdateStickyInput = z.infer<typeof UpdateStickyInputSchema>;

export const BatchUpdateStickiesInputSchema = z.object({
  stickies: z.array(
    z.object({
      id: z.string(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      rotation: z.number().optional(),
      zIndex: z.number().int().optional(),
      color: HexColorSchema.optional(),
      text: z.string().optional(),
      pinnedToDashboard: z.boolean().optional(),
      version: z.number().int().optional(),
    })
  ).max(100),
});
export type BatchUpdateStickiesInput = z.infer<typeof BatchUpdateStickiesInputSchema>;

// ==========================================
// TRANSACTIONS & BUDGETS & GOALS SCHEMAS
// ==========================================

export const CreateTransactionInputSchema = z.object({
  type: z.enum(['expense', 'income']),
  amountMinor: z.number().int().positive('Amount must be positive in minor units (paise)'),
  currency: z.string().length(3).default('INR'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().default(''),
  paymentMethod: z.enum(PAYMENT_METHODS).default('upi'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
  notes: z.string().default(''),
  idempotencyKey: z.string().optional(),
});
export type CreateTransactionInput = z.infer<typeof CreateTransactionInputSchema>;

export const UpdateTransactionInputSchema = CreateTransactionInputSchema.partial();
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionInputSchema>;

export const SetBudgetInputSchema = z.object({
  totalLimitMinor: z.number().int().nonnegative(),
  categoryLimits: z.array(
    z.object({
      category: z.string().min(1),
      limitMinor: z.number().int().nonnegative(),
    })
  ).default([]),
});
export type SetBudgetInput = z.infer<typeof SetBudgetInputSchema>;

export const CreateGoalInputSchema = z.object({
  name: z.string().min(1, 'Goal name is required').max(100),
  targetMinor: z.number().int().positive('Target must be positive in minor units'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  icon: z.string().default('Target'),
  color: HexColorSchema.default('#6366F1'),
});
export type CreateGoalInput = z.infer<typeof CreateGoalInputSchema>;

export const GoalContributionInputSchema = z.object({
  amountMinor: z.number().int(), // positive for deposit, negative for withdrawal
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().default(''),
});
export type GoalContributionInput = z.infer<typeof GoalContributionInputSchema>;
