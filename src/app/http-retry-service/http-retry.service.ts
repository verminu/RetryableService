import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpResponse} from "@angular/common/http";
import {map, NEVER, noop, Observable, Observer, Subscriber, switchMap, takeUntil, timer} from "rxjs";

interface ApiResponse {
    ready: boolean;
    data: any;
}

interface ErrorDataResponse {
    errorCode?: number,
    errorMessage?: string,
    message?: string;
    attempts?: number;
    maxRetries?: number;
    delay?: number;
    totalDelay?: number;
}

interface ErrorResponse {
    error: ErrorDataResponse
}

interface ErrorObjectInterface {
    errorCode: number,
    errorMessage: string
}

interface ServiceResponse {
    ready?: boolean;
    data?: any;
    loading?: boolean,
    error?: ErrorDataResponse
}

type strategyType = 'linear' | 'exponential';

export interface RetryOptions {
    retries?: number;
    interval?: number;
    updateInterval?: number,
    strategy?: strategyType;
    retryOnServerFailure?: boolean,
    retryOnUnexpectedFormat?: boolean,
    liveUpdates?: boolean,
    noUpdates?: boolean,
}

export enum ErrorCodes {
    UNEXPECTED_RESPONSE_FORMAT,
    DATA_NOT_READY_YET,
    UNKNOWN_ERROR,
}

export const ErrorMessages = new Map<ErrorCodes, string>([
    [ErrorCodes.UNEXPECTED_RESPONSE_FORMAT, 'Unexpected response format.'],
    [ErrorCodes.DATA_NOT_READY_YET, 'Data not ready yet.'],
    [ErrorCodes.UNKNOWN_ERROR, 'Server error.'],
]);

@Injectable({
    providedIn: 'root',
})
export class HttpRetryService {
    // Constants for maximum allowed values
    private MAX_RETRIES = 10;
    private MAX_RETRY_INTERVAL = 60000; // 60 seconds
    private MAX_UPDATE_INTERVAL = 10000; // 10 seconds

    // Default options for retry logic
    private defaultOptions: Required<RetryOptions> = {
        retries: 3,
        interval: 3000,
        strategy: 'linear',
        updateInterval: 1000,
        retryOnServerFailure: false,
        retryOnUnexpectedFormat: false,
        liveUpdates: true,
        noUpdates: false,
    }

    constructor(private http: HttpClient) {
    }

    get(url: string, options: RetryOptions, cancelSignal: Observable<void> = NEVER): Observable<ServiceResponse> {
        const allOptions: Required<RetryOptions> = { ...this.defaultOptions, ...options};

        this.validateOptions(allOptions);

        return this.request(url, allOptions, cancelSignal);
    }

    private validateOptions(options: RetryOptions) {
        const {
            retries,
            interval,
            strategy,
            updateInterval,
        } = options;

        if (retries !== undefined &&
            (!Number.isInteger(retries) ||
                retries < 0 ||
                retries > this.MAX_RETRIES)) {
            throw new Error(`Invalid value for retries. It must be a non-negative integer less than ${this.MAX_RETRIES}.`);
        }

        if (interval !== undefined &&
            (!Number.isInteger(interval) ||
                interval < 0 ||
                interval > this.MAX_RETRY_INTERVAL)) {
            throw new Error(`Invalid value for interval. It must be a non-negative integer less than ${this.MAX_RETRY_INTERVAL}.`);
        }

        if (updateInterval !== undefined &&
            (!Number.isInteger(updateInterval) ||
                updateInterval < 0 ||
                updateInterval > this.MAX_UPDATE_INTERVAL)) {
            throw new Error(`Invalid value for updateInterval. It must be a non-negative integer less than ${this.MAX_UPDATE_INTERVAL}.`);
        }

        if (strategy && !['linear', 'exponential'].includes(strategy)) {
            throw new Error('Invalid strategy. Valid values are "linear" or "exponential".');
        }

        options.retryOnUnexpectedFormat = !!options.retryOnUnexpectedFormat
        options.retryOnServerFailure = !!options.retryOnServerFailure
        options.noUpdates = !!options.noUpdates
        options.liveUpdates = !!options.liveUpdates
    }

    private request(url: string, options: Required<RetryOptions>, cancelSignal: Observable<void>): Observable<ServiceResponse> {
        // stores the number of performed retries
        let attempts = 0;

        // store the current time
        const startTime = Date.now();

        return new Observable<ServiceResponse>(observer => {


            const checkResponseObserver: Observer<HttpResponse<object>> = {
                // checks if the response is valid or schedules a retry
                next: (response: HttpResponse<object>) => {
                    if (this.checkForValidResponse(response)) {
                        this.sendAndCompleteResponse(response.body as ApiResponse, observer)
                    }
                    else if (options.retryOnUnexpectedFormat) {
                        scheduleRetry(ErrorCodes.UNEXPECTED_RESPONSE_FORMAT);
                    }
                    else {
                        this.sendErrorAndCompleteResponse(ErrorCodes.UNEXPECTED_RESPONSE_FORMAT, {}, observer);
                    }
                },
                // handles HTTP errors. Sends an error or schedule a retry
                error: (response: HttpErrorResponse) => {
                    if (this.checkResponseForRetry(response)) {
                        scheduleRetry(ErrorCodes.DATA_NOT_READY_YET);
                    }
                    else if (options.retryOnServerFailure) {
                        scheduleRetry(ErrorCodes.UNKNOWN_ERROR);
                    }
                    else {
                        this.sendErrorAndCompleteResponse(ErrorCodes.UNKNOWN_ERROR, {}, observer);
                    }
                },
                complete: noop
            }

            // schedules a retry operation in case of a failure
            const scheduleRetry = (errorCode: ErrorCodes) => {

                if (attempts >= options.retries) {
                    this.sendMaxRetriesError(errorCode, startTime, options, attempts, observer);

                    return;
                }

                const delayBeforeRetry = this.calculateDelayBeforeRetry(options.interval, attempts, options.strategy);

                if (!options.noUpdates) {
                    if (options.liveUpdates) {
                        this.sendLiveUpdates(delayBeforeRetry, attempts, errorCode, options, cancelSignal, observer)
                    } else {
                        this.sendAttemptsUpdate(errorCode, attempts, options, observer);
                    }
                }

                attempts++;

                this.retryFetchAfterDelay(url, delayBeforeRetry, cancelSignal, options, observer, checkResponseObserver);
            };

            // subscribe to a cancel signal to complete the operation if needed
            cancelSignal.subscribe(() => {
                this.completeOperation(observer)
            })

            // initiate the data fetch
            this.fetchData(url, options, cancelSignal, observer)
                .subscribe(checkResponseObserver);
        })

    }

    private createErrorObject(errorCode: ErrorCodes): ErrorObjectInterface {
        return {
            errorCode: errorCode,
            errorMessage: ErrorMessages.get(errorCode) as string
        }
    }

    private buildErrorResponse(errorData: ErrorDataResponse): ErrorResponse {
        return {
            error: errorData
        }
    }

    private calculateDelayBeforeRetry(interval: number, attempts: number, strategy: strategyType) {
        return strategy === 'linear' ? interval : interval * Math.pow(2, attempts);
    };

    private sendResponse(serviceResponse: ServiceResponse, observer: Subscriber<ServiceResponse>) {
        observer.next(serviceResponse);
    }

    private fetchData(url: string, options: RetryOptions, cancelSignal: Observable<void>, observer: Subscriber<ServiceResponse>): Observable<HttpResponse<object>> {
        options.noUpdates || this.sendResponse({loading: true}, observer);

        return this.http.get(url, {observe: 'response'})
            .pipe(
                takeUntil(cancelSignal),
            )
    }

    private sendAndCompleteResponse(serviceResponse: ServiceResponse, observer: Subscriber<ServiceResponse>) {
        this.sendResponse({...serviceResponse, loading: false}, observer);
        this.completeOperation(observer);
    }

    private sendErrorResponse(errorCode: ErrorCodes, additionalData: object, observer: Subscriber<ServiceResponse>) {
        this.sendResponse({
            ...this.buildErrorResponse({...this.createErrorObject(errorCode), ...additionalData}),
            loading: false
        }, observer);
    }

    private sendErrorAndCompleteResponse(errorCode: ErrorCodes, additionalData: object, observer: Subscriber<ServiceResponse>) {
        this.sendErrorResponse(errorCode, additionalData, observer);
        this.completeOperation(observer);
    }


    private checkForValidResponse(httpResponse: HttpResponse<object>) {
        return httpResponse.status === 200
            && (httpResponse.body as ApiResponse)?.ready === true
            && (httpResponse.body as ApiResponse)?.data !== undefined;
    }

    private checkResponseForRetry(httpResponse: HttpErrorResponse) {
        return httpResponse.status === 404
            && (httpResponse.error as ApiResponse)?.ready === false;
    }

    private completeOperation(observer: Subscriber<ServiceResponse>) {
        observer.complete();
    }

    private computeTotalDelay(startTime: number) {
        const endTime = Date.now();
        return endTime - startTime;
    }

    private sendLiveUpdates(delay: number,
                             attempts: number,
                             errorCode: ErrorCodes,
                             options: RetryOptions,
                             cancelSignal: Observable<void>,
                             observer: Subscriber<ServiceResponse>
    ) {
        const retryEndTime = Date.now() + delay;
        const errorCodeObject = this.createErrorObject(errorCode);

        timer(0, options.updateInterval as number)
            .pipe(
                takeUntil(cancelSignal),
                takeUntil(timer(delay)),
                map(() => {
                    const remainingTime = Math.max(retryEndTime - Date.now(), 0);

                    return {
                        ...this.buildErrorResponse({
                            ...errorCodeObject,
                            message: `Retrying in ${Math.ceil(remainingTime / 1000)} seconds... (Attempt ${attempts} of ${options.retries})`,
                            attempts: attempts,
                            maxRetries: options.retries,
                            delay: remainingTime,
                        }),
                        loading: false
                    }
                })
            )
            .subscribe((liveUpdates) =>
                this.sendResponse(liveUpdates, observer)
            );

    }

    private sendAttemptsUpdate(errorCode: ErrorCodes,
                               attempts: number,
                               options: RetryOptions,
                               observer: Subscriber<ServiceResponse>) {
        this.sendErrorResponse(errorCode, {
            message: `Attempt ${attempts} of ${options.retries}`,
            attempts: attempts,
            maxRetries: options.retries
        }, observer);
    }

    private sendMaxRetriesError(errorCode: ErrorCodes,
                                startTime: number,
                                options: RetryOptions,
                                attempts: number,
                                observer: Subscriber<ServiceResponse>){
        const totalDelay = this.computeTotalDelay(startTime);

        this.sendErrorAndCompleteResponse(errorCode, {
            message: `Max retries reached. Retried ${options.retries} times over ${(totalDelay / 1000).toFixed(0)} seconds.`,
            attempts: attempts,
            maxRetries: options.retries,
            totalDelay: totalDelay / 1000
        }, observer);

    }

    private retryFetchAfterDelay(url: string,
                                 delay: number,
                                 cancelSignal: Observable<void>,
                                 options: RetryOptions,
                                 observer: Subscriber<ServiceResponse>,
                                 checkResponseObserver: Observer<HttpResponse<object>>) {
        // wait for the specified amount of time before retrying the request
        // create an observable that emits a single value after the specified delay
        timer(delay)
            .pipe(
                // if the cancelSignal emits a value, the observable chain will complete
                takeUntil(cancelSignal),
                // makes the HTTP request, and ensures that the previous observables returned by fetchData are canceled.
                switchMap(() => this.fetchData(url, options, cancelSignal, observer))
            )
            // analyze the response and perform any retries
            .subscribe(checkResponseObserver);
    }
}
