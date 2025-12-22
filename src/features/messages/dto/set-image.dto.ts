import { ApiProperty } from '@nestjs/swagger';

// Swagger-only DTO to document multipart upload input
export class SetImageDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Image file to set on device' })
  file!: any;
}
