import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RegisterOrRenewSocioInputDto } from './dtos/input/register-or-renew-socio.input.dto';
import { RegisterOrRenewSocioOutputDto } from './dtos/output/register-or-renew-socio.output.dto';
import { SociosService } from './socios.service';

@ApiTags('socios')
@Controller('api/v1/socios')
export class SociosController {
  constructor(private readonly sociosService: SociosService) {}

  @Post('actions/register-or-renew')
  @ApiOperation({ summary: 'Crear o renovar socio en Google Sheets' })
  @ApiHeader({ name: 'X-FORM-KEY', required: true })
  @ApiResponse({ status: 201, type: RegisterOrRenewSocioOutputDto })
  async registerOrRenew(
    @Body() input: RegisterOrRenewSocioInputDto,
    @Headers('x-form-key') formKey?: string,
  ): Promise<RegisterOrRenewSocioOutputDto> {
    return this.sociosService.registerOrRenew(input, formKey);
  }
}
