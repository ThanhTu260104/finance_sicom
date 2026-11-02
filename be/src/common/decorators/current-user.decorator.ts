import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUserPayload } from '../../modules/auth/auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUserPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUserPayload }>();
    return request.user;
  },
);
