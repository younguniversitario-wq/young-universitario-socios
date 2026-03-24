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

  private async sendWithResend(params: {
    to: string;
    subject: string;
    text: string;
    from: string;
  }): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new ApiException(
        ERROR_CODES.EMAIL_NOTIFICATION_ERROR,
        'Missing RESEND_API_KEY configuration.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ApiException(
        ERROR_CODES.EMAIL_NOTIFICATION_ERROR,
        'Resend email sending failed.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        { status: response.status, body },
      );
    }
  }

  private async sendEmail(params: {
    to: string;
    subject: string;
    text: string;
    from: string;
  }): Promise<void> {
    if (process.env.RESEND_API_KEY) {
      await this.sendWithResend(params);
      return;
    }

    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
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

    await this.sendEmail({
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

  async notifyMember(payload: NotifyPayload): Promise<void> {
    const memberEmail = payload.email;
    const fromEmail = process.env.MAIL_FROM;

    if (!memberEmail || !fromEmail) {
      return;
    }

    const subject =
      payload.operation === 'created'
        ? 'Tu alta de socio fue registrada'
        : 'Tu renovacion de socio fue registrada';

    const lines = [
      `Hola ${payload.nombre || ''}`.trim(),
      '',
      payload.operation === 'created'
        ? 'Registramos correctamente tu alta como socio.'
        : 'Registramos correctamente tu renovacion de socio.',
      `Plan: ${payload.plan}`,
      `Vencimiento de suscripcion: ${payload.subscriptionEndsAt}`,
      '',
      'Gracias por apoyar a Young Universitario.',
    ];

    await this.sendEmail({
      from: fromEmail,
      to: memberEmail,
      subject,
      text: lines.join('\n'),
    });

    this.logger.info({
      message: 'Member confirmation email sent',
      data: { operation: payload.operation, ci: payload.ci },
    });
  }
}
