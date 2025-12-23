import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RegisterApnsDto {
    @ApiProperty({ description: 'APNs device token', example: '1a2b3c...' })
    @IsString()
    @IsNotEmpty()
    token!: string;

    @ApiProperty({ description: 'Optional device identifier/name', required: false, example: 'iPhone 15 Pro' })
    @IsString()
    @IsNotEmpty()
    device?: string;
}
    