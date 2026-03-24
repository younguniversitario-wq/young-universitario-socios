import { ApiProperty } from '@nestjs/swagger';

export class RegisterOrRenewSocioOutputDto {
  @ApiProperty({ description: 'Operacion exitosa', example: true })
  ok: boolean;

  @ApiProperty({ description: 'Operacion aplicada', example: 'created', enum: ['created', 'renewed'] })
  operation: 'created' | 'renewed';

  @ApiProperty({ description: 'Mensaje para UI', example: 'Socio registrado correctamente.' })
  message: string;

  @ApiProperty({ description: 'Cedula normalizada', example: '12345678' })
  ci: string;

  @ApiProperty({ description: 'Fecha fin de suscripcion (ISO)', example: '2026-09-24T00:00:00.000Z' })
  subscription_ends_at: string;

  constructor(params: {
    operation: 'created' | 'renewed';
    message: string;
    ci: string;
    subscription_ends_at: string;
  }) {
    this.ok = true;
    this.operation = params.operation;
    this.message = params.message;
    this.ci = params.ci;
    this.subscription_ends_at = params.subscription_ends_at;
  }
}
