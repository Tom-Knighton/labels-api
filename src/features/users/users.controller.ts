import { Body, Controller, Delete, Get, Headers, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Public } from 'src/auth/public.decorator';
import { ApiKeyService } from 'src/auth/api-key.service';
import { env } from 'src/utils/env';
import { ApiKeyAuthGuard } from 'src/auth/api-key-auth.guard';
import { RegisterApnsDto } from './dto/register-apns.dto';
import { ApnsTokenDto } from './dto/apns-token.dto';

@ApiTags('Users')
@UseGuards(ApiKeyAuthGuard)
@ApiSecurity('apiKey')
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService, private readonly authService: ApiKeyService) { }

    @Get("/me")
    @ApiOperation({ summary: 'Get current user info' })
    @ApiResponse({ status: 200, description: 'Current user info', type: UserResponseDto })
    @ApiResponse({ status: 404, description: 'No user assigned to key', type: UserResponseDto })
    async getCurrentUser(@Headers() headers: Record<string, string>): Promise<UserResponseDto> {
        const apiKey = headers[env.API_KEY_HEADER.toLowerCase()] as string;
        const userId = await this.authService.getUserIdByKey(apiKey);

        if (!userId) {
            throw new NotFoundException('User not found');
        }

        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return UserResponseDto.fromDocument(user, apiKey);
    }

    @Public()
    @Get('/home/:homeId/:joinCode')
    @ApiOperation({ summary: 'Get users in a specific home' })
    @ApiResponse({ status: 200, description: 'List of users in the home', type: [UserResponseDto] })
    async getUsersInHome(@Param('homeId') homeId: string, @Param('joinCode') joinCode: string): Promise<UserResponseDto[]> {
        const users = await this.usersService.usersInHome(homeId, joinCode);
        return Promise.all(users.map(async (user) => UserResponseDto.fromDocument(user)));
    }

    @Public()
    @Post()
    @ApiOperation({ summary: 'Create a new user and generate API key' })
    @ApiResponse({ status: 201, description: 'User created successfully', type: UserResponseDto })
    async createUser(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
        const { user, apiKey } = await this.usersService.create(createUserDto);
        return UserResponseDto.fromDocument(user, apiKey);
    }

    @Public()
    @Post('/auth/:userId/home/:homeCode')
    @ApiOperation({ summary: 'Authenticate user for a home and generate API key' })
    @ApiResponse({ status: 201, description: 'User authenticated successfully', type: UserResponseDto })
    async authenticateUserForHome(
        @Param('userId') userId: string,
        @Param('homeCode') homeCode: string,
    ): Promise<UserResponseDto> {
        const user = await this.usersService.authById(userId, homeCode);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const result =  UserResponseDto.fromDocument(user.user, user.apiKey);
        return result;
    }

    @Get('/me/apns')
    @ApiOperation({ summary: 'List APNs tokens for current user' })
    @ApiResponse({ status: 200, description: 'List of APNs tokens', type: [ApnsTokenDto] })
    async listMyApns(@Headers() headers: Record<string, string>): Promise<ApnsTokenDto[]> {
        const apiKey = headers[env.API_KEY_HEADER.toLowerCase()] as string;
        const userId = await this.authService.getUserIdByKey(apiKey);
        if (!userId) {
            throw new NotFoundException('User not found');
        }
        const tokens = await this.usersService.listApnsTokens(userId);
        return tokens.map(ApnsTokenDto.fromDocument);
    }

    @Post('/me/apns')
    @ApiOperation({ summary: 'Register or update an APNs token for current user' })
    @ApiResponse({ status: 201, description: 'APNs token registered', type: ApnsTokenDto })
    async registerMyApns(@Headers() headers: Record<string, string>, @Body() body: RegisterApnsDto): Promise<ApnsTokenDto> {
        const apiKey = headers[env.API_KEY_HEADER.toLowerCase()] as string;
        const userId = await this.authService.getUserIdByKey(apiKey);
        if (!userId) {
            throw new NotFoundException('User not found');
        }
        const doc = await this.usersService.registerApnsToken(userId, body.token, body.device);
        return ApnsTokenDto.fromDocument(doc);
    }

    @Delete('/me/apns/:token')
    @ApiOperation({ summary: 'Delete an APNs token for current user' })
    @ApiResponse({ status: 200, description: 'Deletion result' })
    async deleteMyApns(@Headers() headers: Record<string, string>, @Param('token') token: string): Promise<{ success: boolean }> {
        const apiKey = headers[env.API_KEY_HEADER.toLowerCase()] as string;
        const userId = await this.authService.getUserIdByKey(apiKey);
        if (!userId) {
            throw new NotFoundException('User not found');
        }
        const success = await this.usersService.deleteApnsToken(userId, token);
        return { success };
    }
}
