import { ApiProperty } from '@nestjs/swagger';

export class QueuedMessageDto {
  @ApiProperty({ description: 'Unique message ID' })
  id!: string;

  @ApiProperty({ description: 'Device ID' })
  deviceId!: string;

  @ApiProperty({ description: 'Message type', enum: ['setImage', 'clearImage', 'flash'] })
  type!: 'setImage' | 'clearImage' | 'flash';

  @ApiProperty({ description: 'Message status', enum: ['pending', 'processing', 'completed', 'failed'] })
  status!: 'pending' | 'processing' | 'completed' | 'failed';

  @ApiProperty({ description: 'When the message was enqueued' })
  enqueuedAt!: Date;

  @ApiProperty({ description: 'When processing started', required: false })
  startedAt?: Date;

  @ApiProperty({ description: 'When the message completed or failed', required: false })
  completedAt?: Date;

  @ApiProperty({ description: 'Error message if failed', required: false })
  error?: string;
}
