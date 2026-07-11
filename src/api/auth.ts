import { api } from './client';
import type {
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  MessageResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordResponse,
  VerifyEmailResponse,
} from './types';

/** Auth endpoints — none require a bearer token. */
export const authApi = {
  register: (body: RegisterRequest) =>
    api.post<RegisterResponse>('/auth/register', body, { auth: false }),

  verifyEmail: (token: string) =>
    api.post<VerifyEmailResponse>('/auth/verify-email', { token }, { auth: false }),

  login: (body: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', body, { auth: false }),

  forgotPassword: (email: string) =>
    api.post<ForgotPasswordResponse>('/auth/forgot-password', { email }, { auth: false }),

  resetPassword: (token: string, newPassword: string) =>
    api.post<ResetPasswordResponse | MessageResponse>(
      '/auth/reset-password',
      { token, new_password: newPassword },
      { auth: false },
    ),
};
