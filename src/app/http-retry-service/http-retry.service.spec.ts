import {TestBed} from '@angular/core/testing';

import {HttpRetryService} from './http-retry.service';
import {HttpClient} from "@angular/common/http";
import {HttpClientTestingModule, HttpTestingController} from "@angular/common/http/testing";
import {of} from "rxjs";

describe('HttpRetryService', () => {
  let service: HttpRetryService;
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [HttpRetryService]
    });

    service = TestBed.inject(HttpRetryService);
    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should return data on a successful response. no options are provided.', (done) => {
    const mockResponse = {ready: true, data: 'some data'};
    const url = 'test-url';

    service.get(url, {}, of()).subscribe({
      next: response => {
        // Check if the final data response is received
        if (response.ready) {
          expect(response).toEqual({...mockResponse, loading: false});

          done(); // Mark the test as done
        }
      },
    });

    const req = httpTestingController.expectOne(url);
    expect(req.request.method).toEqual('GET');
    req.flush(mockResponse);
  });

})
