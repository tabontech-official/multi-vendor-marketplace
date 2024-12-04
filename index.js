import app from './app.js';

const port = process.env.PORT || 5000;
app.use((req, res, next) => {
  res.setTimeout(300000, () => {  // Timeout after 5 minutes (300000ms)
    res.status(504).send('Request timed out');
  });
  next();
});

app.listen(port, () => {
  console.log(`App listening on http://localhost:${port}`);
});
  