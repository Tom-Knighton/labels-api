import { ApiProperty } from '@nestjs/swagger';
import { UserDocument } from '../user.schema';

export class UserResponseDto {
  @ApiProperty({ description: 'The unique identifier of the user' })
  id!: string;

  @ApiProperty({ description: 'The name of the user' })
  name!: string;

  @ApiProperty({ description: 'The ID of the home the user belongs to' })
  homeId!: string;

  @ApiProperty({ description: 'Whether the user is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'The API key for the user' })
  apiKey?: string;

  static fromDocument(doc: UserDocument, apiKey?: string): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = doc._id.toString();
    dto.name = doc.name;
    dto.homeId = doc.homeId.toString();
    dto.isActive = doc.isActive;
    
    if (apiKey) {
      dto.apiKey = apiKey;
    }
    
    return dto;
  }
}
