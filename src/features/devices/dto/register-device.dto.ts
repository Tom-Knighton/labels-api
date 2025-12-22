import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Name of the device', example: 'Kitchen Label' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'BLE MAC address of the device', example: 'AA:BB:CC:DD:EE:FF' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({ description: 'Display width in pixels', example: 400 })
  @IsInt()
  @IsPositive()
  width!: number;

  @ApiProperty({ description: 'Display height in pixels', example: 300 })
  @IsInt()
  @IsPositive()
  height!: number;
}
