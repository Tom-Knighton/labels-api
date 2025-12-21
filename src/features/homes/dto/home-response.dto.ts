import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HomeDocument } from '../home.schema';

export class HomeResponseDto {
  @ApiProperty({ description: 'The unique identifier of the home' })
  id!: string;

  @ApiProperty({ description: 'The name of the home' })
  name!: string;

  @ApiProperty({ description: 'Whether the home is private' })
  isPrivate!: boolean;

  @ApiPropertyOptional({ description: 'The join code for the home' })
  joinCode?: string;

  static fromDocument(doc: HomeDocument, includeJoinCode = false): HomeResponseDto {
    const dto = new HomeResponseDto();
    dto.id = doc._id.toString();
    dto.name = doc.name;
    dto.isPrivate = doc.isPrivate;
    
    if (includeJoinCode) {
      dto.joinCode = doc.joinCode;
    }
    
    return dto;
  }
}
