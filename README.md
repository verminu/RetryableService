# Retryable backend operation

The backend developer wants to introduce an API change that allows retryable operation for loading data. The current implementation assumes that when the response is completed, the results are ready for the user.

A ready result is identified as HTTP Status 200 OK and a JSON payload containing the attribute “ready” set to “true”
{“ready”: true, “data”: “aljndau28oadnad828oi82oasdnn2oajsd”}

If the result is not ready yet, the backend will reply with HTTP Status 404 Not Found and a JSON
payload containing the attribute “ready” set to “false”
{ “ready”: false }

## Development server

- Run `ng serve` for the frontend server. Navigate to http://localhost:4200/.
- Run `node server.js` to run the backend server. It starts at http://localhost:3000 

## HttpRetryService Usage Guide

### Overview

The HttpRetryService is designed to handle HTTP GET requests with advanced retry logic. It's particularly useful when dealing with endpoints that might not always immediately return the expected data.

### Key Features

- Retry Logic: Automatically retries failed requests based on configurable parameters.
- Error Handling: Gracefully handles different types of errors, including server failures and unexpected response formats.
- Live Updates: Optionally provides live updates during the retry process.

### How to use

- Import the service
`import { HttpRetryService } from './path-to-http-retry.service';`
- Inject the service
`constructor(private httpRetryService: HttpRetryService) { }`
- Making a Request
`this.httpRetryService.get(url, options, cancelSignal).subscribe(...);`

### Options
The retry logic can be customized with several options:

- retries: Number of retry attempts (default is 3).
- interval: Time in milliseconds between retries (default is 3000ms).
- strategy: Retry strategy, either 'linear' or 'exponential' (default is 'linear').
- retryOnUnexpectedFormat: Whether to retry if the response status is 200 but the response format is not as expected (default is false).
- retryOnServerFailure: Whether to retry on server failures like 5xx errors or other errors different that the ones described above (default is false).
- liveUpdates: Whether to provide live updates during the retry process (default is true).
- noUpdates: If set to true, no intermediate updates will be sent (default is false).

### Response Handling
The response from the get method is an Observable that emits a ServiceResponse object. This object can contain various fields depending on the response and options used:

- ready: Indicates if the response data is ready.
- data: The actual data returned from the server.
- loading: Indicates if a request is currently in progress.
- error: Contains error information if the request fails.

### Error Handling
The service handles various error scenarios:

- Data Not Ready Yet: Occurs when the server indicates that the data is not ready.
- Unexpected Response Format: Triggered when the response from the server doesn't match the expected format.
- Unknown Error: General error for server unreachability or other issues.

### Usage Examples

For a list of comprehensive examples, see src/app/app.component.html
