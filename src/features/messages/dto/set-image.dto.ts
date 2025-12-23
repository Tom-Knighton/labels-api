import { ApiProperty } from '@nestjs/swagger';

export class SetImageDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Image file to set on device' })
  file!: any;
}
