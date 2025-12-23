import { ApiProperty } from '@nestjs/swagger';
import { ApnsTokenDocument } from '../apns.schema';

export class ApnsTokenDto {
  @ApiProperty({ description: 'APNs device token' })
  token!: string;

  @ApiProperty({ description: 'Optional device identifier/name', required: false })
  device?: string | null;

  @ApiProperty({ description: 'Whether the token is enabled for notifications' })
  enabled!: boolean;

  @ApiProperty({ description: 'Creation time' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update time' })
  updatedAt!: Date;

  static fromDocument(doc: ApnsTokenDocument): ApnsTokenDto {
    const dto = new ApnsTokenDto();
    dto.token = doc.token;
    dto.device = doc.device ?? null;
    dto.enabled = doc.enabled;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dto.createdAt = (doc as any).createdAt;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dto.updatedAt = (doc as any).updatedAt;
    return dto;
  }
}
