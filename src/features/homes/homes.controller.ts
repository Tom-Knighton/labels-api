import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from 'src/auth/api-key-auth.guard';

@ApiTags('hello')
@Controller()
export class HomesController {
    @Get('hello')
    @UseGuards(ApiKeyAuthGuard)
    @ApiSecurity('apiKey')
    hello(): { message: string } {
        return { message: 'Hello, authenticated world.' };
    }
}