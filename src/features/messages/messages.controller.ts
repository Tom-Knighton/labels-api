import { Controller, Post, Param, UseGuards, Headers, Body, Req, Get } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from 'src/auth/api-key-auth.guard';
import { MessagesService } from './messages.service';
import { SetImageDto } from './dto/set-image.dto';
import { FlashDto } from './dto/flash.dto';
import { QueuedMessageDto } from './dto/queued-message.dto';
import type { FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { MessagesQueueService } from './messages-queue.service';

@ApiTags('Messages')
@UseGuards(ApiKeyAuthGuard)
@ApiSecurity('apiKey')
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly queueService: MessagesQueueService,
  ) {}

  @Post(':deviceId/image')
  @ApiOperation({ summary: 'Set image on a device' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SetImageDto })
  @ApiResponse({ status: 202, description: 'Image accepted for processing' })
  async setImage(
    @Param('deviceId') deviceId: string,
    @Req() req: FastifyRequest,
  ): Promise<{ accepted: true }> {
    const file: MultipartFile = await (req as any).file();
    await this.messagesService.setImage(deviceId, file);
    return { accepted: true };
  }

  @Post(':deviceId/clear')
  @ApiOperation({ summary: 'Clear image on a device' })
  @ApiResponse({ status: 202, description: 'Clear command accepted' })
  async clearImage(
    @Param('deviceId') deviceId: string,
  ): Promise<{ accepted: true }> {
    await this.messagesService.clearImage(deviceId);
    return { accepted: true };
  }

  @Post(':deviceId/flash')
  @ApiOperation({ summary: 'Flash device with color' })
  @ApiResponse({ status: 202, description: 'Flash command accepted' })
  async flash(
    @Param('deviceId') deviceId: string,
    @Body() dto: FlashDto,
  ): Promise<{ accepted: true }> {
    await this.messagesService.flash(deviceId, dto.color);
    return { accepted: true };
  }

  @Get(':deviceId/queue')
  @ApiOperation({ summary: 'Get queued messages for a device' })
  @ApiResponse({ status: 200, description: 'Queue retrieved', type: [QueuedMessageDto] })
  async getQueue(
    @Param('deviceId') deviceId: string,
  ): Promise<QueuedMessageDto[]> {
    return this.queueService.getQueuedMessages(deviceId);
  }
}
