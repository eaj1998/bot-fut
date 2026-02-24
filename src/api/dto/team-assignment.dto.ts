import { IsString, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TeamAssignmentDto {
    @IsString()
    rosterId!: string;

    @IsEnum(['A', 'B'])
    team!: 'A' | 'B';
}

export class SaveTeamAssignmentsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => TeamAssignmentDto)
    assignments!: TeamAssignmentDto[];
}
