import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from 'src/auth/api-key-auth.guard';
import { HomesService } from './homes.service';
import { CreateHomeDto } from './dto/create-home.dto';
import { HomeResponseDto } from './dto/home-response.dto';
import { Public } from 'src/auth/public.decorator';

@ApiTags('Homes')
@UseGuards(ApiKeyAuthGuard)
@ApiSecurity('apiKey')
@Controller()
export class HomesController {
    constructor(private readonly homesService: HomesService) {}

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

    @Get('hello')
    hello(): { message: string } {
        return { message: 'Hello, authenticated world.' };
    }
}