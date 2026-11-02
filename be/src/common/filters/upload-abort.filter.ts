import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import type { HttpServer } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response, Request } from 'express';

/**
 * Multer emits "Request aborted" when the browser cancels mid-upload.
 * Avoid treating it as an unhandled 500.
 */
@Catch()
export class UploadAbortFilter extends BaseExceptionFilter {
  private readonly uploadLogger = new Logger(UploadAbortFilter.name);

  constructor(applicationRef?: HttpServer) {
    super(applicationRef);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const message =
      exception instanceof Error ? exception.message : String(exception);
    const isAbort =
      message === 'Request aborted' ||
      (exception as { code?: string })?.code === 'ECONNABORTED';

    if (isAbort) {
      const ctx = host.switchToHttp();
      const res = ctx.getResponse<Response>();
      const req = ctx.getRequest<Request>();
      this.uploadLogger.warn(
        `Upload aborted by client: ${req.method} ${req.url}`,
      );
      if (!res.headersSent) {
        res.status(499).json({
          statusCode: 499,
          message: 'Upload bị hủy giữa chừng. Vui lòng thử lại.',
        });
      }
      return;
    }

    super.catch(exception, host);
  }
}
