import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserContext {
  userId: string;
  email: string;
  name: string;
  roles: string[];
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user || {
      userId: 'e1111111-1111-1111-1111-111111111111',
      email: 'admin@vcams.internal',
      name: 'Super Admin (Dev)',
      roles: ['ADMIN', 'SECURITY_OFFICER'],
    };
  },
);
