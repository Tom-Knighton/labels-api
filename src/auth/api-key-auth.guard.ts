import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { env } from '../utils/env';
import { ApiKeyService } from './api-key.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
    constructor(
        private readonly apiKeyService: ApiKeyService,
        private reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        
        if (isPublic) {
            return true;
        }

        const req = context.switchToHttp().getRequest<FastifyRequest>();

        const headerName = env.API_KEY_HEADER.toLowerCase();
        const apiKey = req.headers[headerName];

        if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
            throw new UnauthorizedException(`Missing ${env.API_KEY_HEADER} header`);
        }

        const ok = await this.apiKeyService.isValidApiKey(apiKey);
        if (!ok) {
            throw new UnauthorizedException('Invalid API key');
        }

        return true;
    }
}
