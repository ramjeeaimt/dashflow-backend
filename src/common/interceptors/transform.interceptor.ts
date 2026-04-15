import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  statusCode: number;
  message: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  private readonly logger = new Logger(TransformInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const { method, originalUrl, body, params, query } = request;
    const startTime = Date.now();

    // Log Request
    this.logger.log(`Incoming Request: ${method} ${originalUrl}`);

    return next.handle().pipe(
      tap((data) => {
        const responseTime = Date.now() - startTime;
        this.logger.log(`Response: ${method} ${originalUrl} [${response.statusCode}] ${responseTime}ms`);
      }),
      map((data) => ({
        data,
        statusCode: response.statusCode,
        message: 'Success',
      })),
    );
  }
}
