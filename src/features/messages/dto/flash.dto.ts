import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class FlashDto {
  @ApiProperty({ description: 'Hex color code in #RRGGBB format', example: '#FF00AA' })
  @Matches(/^#?[0-9A-Fa-f]{6}$/)
  color!: string;
}
