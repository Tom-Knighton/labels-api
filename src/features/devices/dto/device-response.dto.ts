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
      currentImageAssetId: { type: 'string', nullable: true },
      isFlashing: { type: 'boolean' },
      lastSuccessfulActionAt: { type: 'string', format: 'date-time', nullable: true },
      lastSeenAt: { type: 'string', format: 'date-time', nullable: true },
      lastError: { type: 'string', nullable: true }
    }
  })
  shadow!: {
    currentImageAssetId?: string | null;
    isFlashing: boolean;
    lastSuccessfulActionAt?: Date | null;
    lastSeenAt?: Date | null;
    lastError?: string | null;
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
      currentImageAssetId: doc.shadow.currentImageAssetId ?? null,
      isFlashing: doc.shadow.isFlashing,
      lastSuccessfulActionAt: doc.shadow.lastSuccessfulActionAt ?? null,
      lastSeenAt: doc.shadow.lastSeenAt ?? null,
      lastError: doc.shadow.lastError ?? null,
    };
    dto.createdAt = (doc as any).createdAt;
    dto.updatedAt = (doc as any).updatedAt;
    return dto;
  }
}
