import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
    private logger = new Logger('HTTP');

    use(request: Request, response: Response, next: NextFunction): void {
        const { ip, method, originalUrl } = request;
        const userAgent = request.get('user-agent') || '';
        const startTime = Date.now();

        // Log the incoming request
        this.logger.log(
            JSON.stringify({
                event: 'request_started',
                method,
                url: originalUrl,
                ip,
                userAgent,
            })
        );

        response.on('finish', () => {
            const { statusCode } = response;
            const contentLength = response.get('content-length') || 0;
            const duration = Date.now() - startTime;

            const logData = {
                event: 'request_completed',
                method,
                url: originalUrl,
                statusCode,
                contentLength,
                durationMs: duration,
                ip,
                userAgent,
            };

            if (statusCode >= 400) {
                this.logger.error(JSON.stringify(logData));
            } else {
                this.logger.log(JSON.stringify(logData));
            }
        });

        next();
    }
}
