import { Injectable, HttpStatus } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import nodemailer from 'nodemailer';
import { ApiException } from '../common/errors/api.exception';
import { ERROR_CODES } from '../common/errors/error-codes';

interface NotifyPayload {
  operation: 'created' | 'renewed';
  ci: string;
  nombre?: string;
  plan: 'semestral' | 'anual';
  email?: string;
  telefono?: string;
  paymentRef?: string;
  subscriptionEndsAt: string;
}

@Injectable()
export class AdminEmailService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AdminEmailService.name);
  }

  private getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      throw new ApiException(
        ERROR_CODES.EMAIL_NOTIFICATION_ERROR,
        'Missing SMTP configuration.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  async notifyAdmin(payload: NotifyPayload): Promise<void> {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    const fromEmail = process.env.MAIL_FROM;

    if (!adminEmail || !fromEmail) {
      throw new ApiException(
        ERROR_CODES.EMAIL_NOTIFICATION_ERROR,
        'Missing ADMIN_NOTIFICATION_EMAIL or MAIL_FROM configuration.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const transporter = this.getTransporter();

    const subject =
      payload.operation === 'created'
        ? 'Nuevo socio registrado'
        : 'Renovacion de socio registrada';

    const lines = [
      `Operacion: ${payload.operation}`,
      `CI: ${payload.ci}`,
      `Nombre: ${payload.nombre || 'N/A'}`,
      `Plan: ${payload.plan}`,
      `Email: ${payload.email || 'N/A'}`,
      `Telefono: ${payload.telefono || 'N/A'}`,
      `Referencia de pago: ${payload.paymentRef || 'N/A'}`,
      `Vencimiento suscripcion: ${payload.subscriptionEndsAt}`,
    ];

    await transporter.sendMail({
      from: fromEmail,
      to: adminEmail,
      subject,
      text: lines.join('\n'),
    });

    this.logger.info({
      message: 'Admin email notification sent',
      data: { operation: payload.operation, ci: payload.ci },
    });
  }
}
