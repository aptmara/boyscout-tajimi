    }
  } catch (err) {
    console.error('POST /api/settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ------------------------------
// /json-api を mount（最後でOK）
// ------------------------------
const jsonApi = require('./server-json');      // Router
app.use('/json-api', jsonApi);

// /uploads をグローバルで公開（server-json.js の保存先を流用）
const UPLOAD_DIR = jsonApi.UPLOAD_DIR;
app.use('/uploads', express.static(UPLOAD_DIR, {
  etag: true,
  maxAge: '7d',
  immutable: true,
}));

// ------------------------------
// 起動（唯一の listen ）
// ------------------------------
function startServer(app) {
  const port = Number(process.env.PORT || 10000);
  const host = process.env.HOST || '0.0.0.0';
  const server = app.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
    console.log(`env.PORT=${process.env.PORT ?? 'undefined'}`);
  });
  return server;
}

startServer(app);
