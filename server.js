const jsonServer = require('json-server');
const server = jsonServer.create();
const middlewares = jsonServer.defaults();

server.use(middlewares);

// valid response
server.get('/valid-data', (req, res) => {
  res.status(200).jsonp({
    ready: true,
    data: "Welcome to Trimble"
  });
});

// data is not ready yet
server.get('/data-not-ready', (req, res) => {
  res.status(404).jsonp({
    ready: false
  });
});

// data is not ready yet, but it will be after 10 seconds
let firstRequestTime = null;
server.get('/data-not-ready-then-ready', (req, res) => {
  const currentTime = Date.now();

  // Check if first request time is set
  if (!firstRequestTime) {
    firstRequestTime = currentTime;
    res.status(404).jsonp({ ready: false });
  } else {
    // Check if 10 seconds have passed since the first request
    if (currentTime - firstRequestTime >= 10000) {
      res.status(200).jsonp({ ready: true, data: "Welcome to Trimble" });
    } else {
      res.status(404).jsonp({ ready: false });
    }
  }
});


// data looks ready, but the status is 404.
// this will be considered a server error
server.get('/invalid-format-404', (req, res) => {
  res.status(404).jsonp({
    ready: true,
    data: "Welcome to Trimble"
  });
});

// invalid format, even if the status is 200
// this will be considered an invalid format error
server.get('/invalid-format-200', (req, res) => {
  res.status(200).jsonp({
    ready: false,
    data: "Welcome to Trimble"
  });
});

// the server sends a 500 error
server.get('/server-error-500', (req, res) => {
  res.status(500).jsonp({
    error: "500 error"
  });
});



server.listen(3000, () => {
  console.log('JSON Server is running');
});
