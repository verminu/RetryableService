import {Component, Input, OnDestroy} from '@angular/core';
import { CommonModule } from '@angular/common';
import {Subject, takeUntil} from "rxjs";
import {HttpRetryService, RetryOptions} from "../http-retry-service/http-retry.service";
import {MatCardModule} from "@angular/material/card";
import {MatProgressBarModule} from "@angular/material/progress-bar";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatButtonModule} from "@angular/material/button";

@Component({
  selector: 'app-retry-service',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatProgressBarModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './retry-service.component.html',
  styleUrl: './retry-service.component.css'
})
export class RetryServiceComponent implements OnDestroy {

  @Input({required: true}) url!: string;
  @Input() retryOptions: RetryOptions = {}
  @Input() description: string = '';

  // stores the data received from the service
  data: any = null;

  // any error message to be displayed
  errorMessage: string = '';

  // create a subject to cancel the entire retry operation
  private cancel$ = new Subject<void>();

  // used for unsubscribing from the service when the component is destroyed
  private unsubscribe$ = new Subject<void>();

  // indicates that an entire retry operation is in progress
  operationInProgress = false;

  // indicates that an HTTP request is in progress
  requestLoading = false;

  constructor(private httpRetryService: HttpRetryService) {
  }

  loadData() {
    this.operationInProgress = true;

    // cancel any existing ongoing operation
    this.cancel$.next();

    // call the service
    this.httpRetryService.get(this.url, this.retryOptions, this.cancel$.asObservable())
      .pipe(
        // unsubscribe when this.unsubscribe$ emits
        takeUntil(this.unsubscribe$)
      )
      .subscribe({
        next: (response) => {
          if (response.loading !== undefined) {
            this.requestLoading = response.loading;
          }

          if (response.ready) {
            // indicates that the data is successfully received
            this.data = response.data;
            this.errorMessage = '';
          }
          else {
            // display the errors (the actual error message from the service and any additional information)
            if (response.error) {
              // update the message only when there is an error received from the service
              this.errorMessage = (response.error?.errorMessage || '') + (' ' + (response.error?.message || ''));
            }
            this.data = null;
          }
        },
        error: () => {
          // Handle any unexpected errors here
          this.errorMessage = 'An unexpected error occurred';
          this.data = null;

          // reset the flags
          this.operationInProgress = false;
          this.requestLoading = false;
        },
        complete: () => {
          this.operationInProgress = false;
          this.requestLoading = false;
        }
      });
  }

  // abort the entire retry operation
  stopLoading() {
    this.cancel$.next();

    this.data = null;
    this.errorMessage = '';
  }

  ngOnDestroy() {
    this.cancel$.next();
    this.cancel$.complete();

    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

}
