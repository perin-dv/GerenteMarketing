import { IsString, IsUUID, MinLength } from "class-validator";

export class SwitchWorkspaceDto {
  @IsUUID()
  companyId!: string;
}

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  name!: string;
}
