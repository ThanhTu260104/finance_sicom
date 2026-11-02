import { UserAccessMode, UserRole } from '@prisma/client';

export type AuthUserPayload = {
  sub: string;
  email: string;
  role: UserRole;
  displayName: string;
  /** Nạp từ DB mỗi request (không nằm trong JWT) */
  accessMode: UserAccessMode;
  permissions: string[];
};

export type SafeAppUser = {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  accessMode: UserAccessMode;
  permissions: string[];
  createdAt: string;
};
