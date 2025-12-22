import { ApiProperty } from '@nestjs/swagger';
import { DeviceResponseDto } from '../../devices/dto/device-response.dto';

export class UserWithDevicesDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  homeId!: string;

  @ApiProperty({ type: [DeviceResponseDto] })
  devices!: DeviceResponseDto[];
}

export class HomeDetailsDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isPrivate!: boolean;

  @ApiProperty()
  joinCode!: string;

  @ApiProperty({ type: [UserWithDevicesDto] })
  users!: UserWithDevicesDto[];
}
