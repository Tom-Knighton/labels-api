import { ApiProperty } from '@nestjs/swagger';
import { DeviceDocument } from '../device.schema';

export class DeviceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  homeId!: string;

  @ApiProperty()
  ownerUserId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: 'object', properties: { address: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' } } })
  ble!: { address: string, width: number, height: number };

  @ApiProperty({
    type: 'object', properties: {
      currentImagePreviewBase64: { type: 'string', nullable: true },
      currentImagePreviewType: { type: 'string', nullable: true },
      currentImagePreviewWidth: { type: 'number', nullable: true },
      currentImagePreviewHeight: { type: 'number', nullable: true },
      isFlashing: { type: 'boolean' },
      lastSuccessfulActionAt: { type: 'string', format: 'date-time', nullable: true },
      lastSeenAt: { type: 'string', format: 'date-time', nullable: true },
      lastError: { type: 'string', nullable: true },
      lastErrors: { type: 'array', items: { type: 'string' } },
      lastFlashed: { type: 'string', format: 'date-time', nullable: true },
      flashedFor: { type: 'number', nullable: true }
    }
  })
  shadow!: {
    currentImagePreviewBase64?: string | null;
    currentImagePreviewType?: string | null;
    currentImagePreviewWidth?: number | null;
    currentImagePreviewHeight?: number | null;
    isFlashing: boolean;
    lastSuccessfulActionAt?: Date | null;
    lastSeenAt?: Date | null;
    lastError?: string | null;
    lastErrors?: string[];
    lastFlashed?: Date | null;
    flashedFor?: number | null;
  };

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromDocument(doc: DeviceDocument): DeviceResponseDto {
    const dto = new DeviceResponseDto();
    dto.id = doc._id.toString();
    dto.homeId = doc.homeId.toString();
    dto.ownerUserId = doc.ownerUserId.toString();
    dto.name = doc.name;
    dto.ble = { address: doc.ble.address, width: doc.ble.width, height: doc.ble.height };
    dto.shadow = {
      currentImagePreviewBase64: doc.shadow.currentImagePreviewBase64 ?? null,
      currentImagePreviewType: doc.shadow.currentImagePreviewType ?? null,
      currentImagePreviewWidth: doc.shadow.currentImagePreviewWidth ?? null,
      currentImagePreviewHeight: doc.shadow.currentImagePreviewHeight ?? null,
      isFlashing: doc.shadow.isFlashing,
      lastSuccessfulActionAt: doc.shadow.lastSuccessfulActionAt ?? null,
      lastSeenAt: doc.shadow.lastSeenAt ?? null,
      lastError: doc.shadow.lastError ?? null,
      lastErrors: doc.shadow.lastErrors ?? [],
      lastFlashed: doc.shadow.lastFlashed ?? null,
      flashedFor: doc.shadow.flashedFor ?? null,
    };
    dto.createdAt = (doc as any).createdAt;
    dto.updatedAt = (doc as any).updatedAt;
    return dto;
  }
}
