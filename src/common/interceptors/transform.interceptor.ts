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

    // Log Request with Body
    this.logger.log('\n' + JSON.stringify({ 
      event: 'incoming_request_data', 
      method, 
      originalUrl, 
      requestBody: Object.keys(body || {}).length ? body : undefined 
    }, null, 2));

    return next.handle().pipe(
      tap((data) => {
        const responseTime = Date.now() - startTime;
        // Log Response with Data
        this.logger.log('\n' + JSON.stringify({ 
          event: 'outgoing_response_data', 
          method, 
          originalUrl, 
          statusCode: response.statusCode, 
          responseTimeMs: responseTime, 
          responseData: data 
        }, null, 2));
      }),
      map((data) => ({
        data,
        statusCode: response.statusCode,
        message: 'Success',
      })),
    );
  }
}
