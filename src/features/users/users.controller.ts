import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Public } from 'src/auth/public.decorator';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a new user and generate API key' })
  @ApiResponse({ status: 201, description: 'User created successfully', type: UserResponseDto })
  async createUser(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const { user, apiKey } = await this.usersService.create(createUserDto);
    return UserResponseDto.fromDocument(user, apiKey);
  }
}
