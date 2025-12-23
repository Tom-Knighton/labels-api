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
import { ApiKeyService } from 'src/auth/api-key.service';
import { env } from 'src/utils/env';

@ApiTags('Messages')
@UseGuards(ApiKeyAuthGuard)
@ApiSecurity('apiKey')
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly queueService: MessagesQueueService,
    private readonly authService: ApiKeyService,
  ) {}

  @Post(':deviceId/image')
  @ApiOperation({ summary: 'Set image on a device' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SetImageDto })
  @ApiResponse({ status: 202, description: 'Image accepted for processing' })
  async setImage(
    @Param('deviceId') deviceId: string,
    @Req() req: FastifyRequest,
  ): Promise<{ accepted: boolean }> {
    try {
      const file = await (req as any).file();
      if (!file) {
        return { accepted: false };
      }

      const apiKey = (req.headers as Record<string, string>)[env.API_KEY_HEADER.toLowerCase()] as string;
      const userId = await this.authService.getUserIdByKey(apiKey);
      
      const fileBuffer = await this.messagesService.readFileFromMultipart(file);
      
      void this.messagesService.processImageInBackground(deviceId, fileBuffer, userId ?? undefined);
      
      return { accepted: true };
    } catch (error) {
      console.error('Error accepting image:', error);
      return { accepted: false };
    }
  }

  @Post(':deviceId/clear')
  @ApiOperation({ summary: 'Clear image on a device' })
  @ApiResponse({ status: 202, description: 'Clear command accepted' })
  async clearImage(
    @Param('deviceId') deviceId: string,
    @Headers() headers: Record<string, string>,
  ): Promise<{ accepted: boolean }> {
    const apiKey = headers[env.API_KEY_HEADER.toLowerCase()] as string | undefined;
    const userId = apiKey ? await this.authService.getUserIdByKey(apiKey) : undefined;
    void this.messagesService.clearImageInBackground(deviceId, userId ?? undefined);
    return { accepted: true };
  }

  @Post(':deviceId/flash')
  @ApiOperation({ summary: 'Flash device with color' })
  @ApiResponse({ status: 202, description: 'Flash command accepted' })
  async flash(
    @Param('deviceId') deviceId: string,
    @Body() dto: FlashDto,
    @Headers() headers: Record<string, string>,
  ): Promise<{ accepted: boolean }> {
    const apiKey = headers[env.API_KEY_HEADER.toLowerCase()] as string | undefined;
    const userId = apiKey ? await this.authService.getUserIdByKey(apiKey) : undefined;
    void this.messagesService.flashInBackground(deviceId, dto.color, userId ?? undefined);
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
