import { Body, Controller, Delete, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { DeviceResponseDto } from './dto/device-response.dto';
import { ApiKeyAuthGuard } from 'src/auth/api-key-auth.guard';
import { env } from 'src/utils/env';

@ApiTags('Devices')
@UseGuards(ApiKeyAuthGuard)
@ApiSecurity('apiKey')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all devices for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Devices retrieved', type: [DeviceResponseDto] })
  async getMyDevices(
    @Headers() headers: Record<string, string>,
  ): Promise<DeviceResponseDto[]> {
    const apiKey = headers[env.API_KEY_HEADER.toLowerCase()] as string;
    const devices = await this.devicesService.getDevicesForUser(apiKey);
    return devices.map(device => DeviceResponseDto.fromDocument(device));
  }

  @Post()
  @ApiOperation({ summary: 'Register a device to the authenticated user' })
  @ApiResponse({ status: 201, description: 'Device registered', type: DeviceResponseDto })
  async register(
    @Body() dto: RegisterDeviceDto,
    @Headers() headers: Record<string, string>,
  ): Promise<DeviceResponseDto> {
    const apiKey = headers[env.API_KEY_HEADER.toLowerCase()] as string;
    const device = await this.devicesService.registerForUser(apiKey, dto);
    return DeviceResponseDto.fromDocument(device);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a device owned by the authenticated user' })
  @ApiResponse({ status: 200, description: 'Device removed' })
  async remove(
    @Param('id') id: string,
    @Headers() headers: Record<string, string>,
  ): Promise<{ removed: true }> {
    const apiKey = headers[env.API_KEY_HEADER.toLowerCase()] as string;
    await this.devicesService.removeForUser(apiKey, id);
    return { removed: true };
  }
}
