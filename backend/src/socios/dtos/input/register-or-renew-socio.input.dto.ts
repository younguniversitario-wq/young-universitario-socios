import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RegisterOrRenewSocioInputDto {
  @ApiProperty({ description: 'Tipo de socio', example: 'nuevo', enum: ['nuevo', 'renovacion'] })
  @IsIn(['nuevo', 'renovacion'])
  member_type!: 'nuevo' | 'renovacion';

  @ApiProperty({ description: 'Cedula sin puntos ni guiones', example: '12345678' })
  @IsString()
  @Matches(/^\d+$/)
  ci!: string;

  @ApiProperty({ description: 'Plan elegido', example: 'semestral', enum: ['semestral', 'anual'] })
  @IsIn(['semestral', 'anual'])
  plan!: 'semestral' | 'anual';

  @ApiProperty({ description: 'Referencia de pago', example: 'MP-12345', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  payment_ref?: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Juan Perez', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @ApiProperty({ description: 'Telefono', example: '+59899999999', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefono?: string;

  @ApiProperty({ description: 'Email', example: 'socio@email.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Si desea carnet', example: 'si', required: false, enum: ['si', 'no'] })
  @IsOptional()
  @IsIn(['si', 'no'])
  wants_carnet?: 'si' | 'no';

  @ApiProperty({ description: 'Fecha de nacimiento', example: '1998-03-12', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  birth_date?: string;

  @ApiProperty({ description: 'Categoria para carnet', example: 'mayor', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiProperty({ description: 'URL de la pagina origen', example: 'https://younguniversitario-wq.github.io/young-universitario-socios/' })
  @IsString()
  @MaxLength(500)
  pageUrl!: string;

  @ApiProperty({ description: 'UTM source', example: 'instagram', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utm_source?: string;

  @ApiProperty({ description: 'UTM medium', example: 'social', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utm_medium?: string;

  @ApiProperty({ description: 'UTM campaign', example: 'campana_socios_2026', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utm_campaign?: string;

  @ApiProperty({ description: 'UTM content', example: 'cta_hero', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utm_content?: string;

  @ApiProperty({ description: 'UTM term', example: 'socio', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utm_term?: string;
}
