import { Body, Controller, Get, Headers, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from 'src/auth/api-key-auth.guard';
import { HomesService } from './homes.service';
import { CreateHomeDto } from './dto/create-home.dto';
import { HomeResponseDto } from './dto/home-response.dto';
import { Public } from 'src/auth/public.decorator';
import { HomeDetailsDto } from './dto/home-details.dto';
import { ApiKeyService } from 'src/auth/api-key.service';
import { env } from 'src/utils/env';

@ApiTags('Homes')
@UseGuards(ApiKeyAuthGuard)
@ApiSecurity('apiKey')
@Controller('homes')
export class HomesController {
    constructor(
        private readonly homesService: HomesService,
        private readonly apiKeyService: ApiKeyService,
    ) {}

    @Public()
    @Post()
    @ApiOperation({ summary: 'Create a new home' })
    @ApiResponse({ status: 201, description: 'Home created successfully', type: HomeResponseDto })
    async createHome(@Body() createHomeDto: CreateHomeDto): Promise<HomeResponseDto> {
        const home = await this.homesService.create(createHomeDto);
        return HomeResponseDto.fromDocument(home, false);
    }

    @Public()
    @Get(':joinCode')
    @ApiOperation({ summary: 'Get home by join code' })
    @ApiResponse({ status: 200, description: 'Home found', type: HomeResponseDto })
    @ApiResponse({ status: 404, description: 'Home not found' })
    async getHomeByJoinCode(@Param('joinCode') joinCode: string): Promise<HomeResponseDto> {
        const home = await this.homesService.findByJoinCode(joinCode);
        
        if (!home) {
            throw new NotFoundException('Home not found');
        }
        
        return HomeResponseDto.fromDocument(home, true);
    }

    @Get('my')
    @ApiOperation({ summary: 'Get authenticated user\'s home with all users and devices' })
    @ApiResponse({ status: 200, description: 'Home details retrieved', type: HomeDetailsDto })
    async getMyHomeDetails(@Headers() headers: Record<string, string>): Promise<HomeDetailsDto> {
        const apiKey = headers[env.API_KEY_HEADER.toLowerCase()] as string;
        const userId = await this.apiKeyService.getUserIdByKey(apiKey);
        
        if (!userId) {
            throw new NotFoundException('User not found');
        }

        return this.homesService.getHomeDetailsForUser(userId);
    }

    
}