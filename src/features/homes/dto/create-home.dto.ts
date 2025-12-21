import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateHomeDto {
  @ApiProperty({ description: 'The name of the home' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
