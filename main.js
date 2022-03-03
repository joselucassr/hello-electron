const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

const http = require('http');
const { Server } = require('socket.io');

const express = require('express');
const exp = express();
const port = process.env.PORT || 8080;
var fs = require('fs');

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const chokidar = require('chokidar');

const watcher = chokidar.watch();

// async function handleFileOpen(s) {
//   const { canceled, filePaths } = await dialog.showOpenDialog();
//   if (canceled) {
//     return;
//   } else {
//     console.log(`/browserIndex.html?img=${encodeURI(filePaths[0])}`);

//     io.on('connection', (socket) => {
//       console.log('a user connected');

//       socket.on('getImageId', (msg) => {
//         console.log('a user connected');
//         io.emit('imageID', filePaths[0]);
//       });
//     });

//     return filePaths[0];
//   }
// }

function createWindow() {
  // Código encontrado em: https://stackoverflow.com/questions/3653065/get-local-ip-address-in-node-js
  const { networkInterfaces } = require('os');

  const nets = networkInterfaces();
  const results = Object.create(null); // Or just '{}', an empty object

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        if (!results[name]) {
          results[name] = [];
        }
        results[name].push(net.address);
      }
    }
  }

  // Pega o primeiro IP
  console.log(results[Object.keys(results)[0]][0]);

  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow.loadFile('index.html');
}

app.enableSandbox();

app.whenReady().then(() => {
  // Código encontrado em: https://stackoverflow.com/questions/5823722/how-to-serve-an-image-using-nodejs
  var dir = path.join(__dirname, 'public');

  var mime = {
    html: 'text/html',
    txt: 'text/plain',
    css: 'text/css',
    gif: 'image/gif',
    jpg: 'image/jpeg',
    png: 'image/png',
    svg: 'image/svg+xml',
    js: 'application/javascript',
  };

  exp.get('*', function (req, res) {
    res.set('Cache-control', 'no-store');
    var file = path.join(dir, req.path.replace(/\/$/, `/browserIndex.html`));
    if (file.indexOf(dir + path.sep) !== 0) {
      return res.status(403).end('Forbidden');
    }
    var type = mime[path.extname(file).slice(1)] || 'text/plain';
    var s = fs.createReadStream(file);
    s.on('open', function () {
      res.set('Content-Type', type);
      s.pipe(res);
    });
    s.on('error', function () {
      res.set('Content-Type', 'text/plain');
      res.status(404).end('Not found');
    });
  });

  io.listen(8081);

  exp.listen(port);
  console.log('Server started at http://localhost:' + port);

  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog();
    if (canceled) {
      return;
    } else {
      // io.emit('update', '');

      let filename =
        filePaths[0].split('/')[filePaths[0].split('/').length - 1];

      let publicTempFolder = path.join(dir, 'temp');
      let publicImgPath = path.join(publicTempFolder, filename);

      // fs.readdir(publicTempFolder, (err, files) => {
      //   if (err) throw err;

      //   for (const file of files) {
      //     console.log(file);
      //     fs.unlink(path.join(publicTempFolder, file), (err) => {
      //       if (err) throw err;
      //     });
      //   }
      // });

      fs.copyFile(filePaths[0], publicImgPath, (err) => {
        if (err) throw err;
        console.log('image was copied to temp folder.');
      });

      // let rawdata = fs.readFileSync(path.join(dir, 'filesInfo.json'));
      // let jsonData = JSON.parse(rawdata);
      // console.log(jsonData);

      let fileInfo = {
        tempFileName: filename,
      };
      let data = JSON.stringify(fileInfo, null, 2);
      fs.writeFileSync(path.join(dir, 'filesInfo.json'), data);

      io.emit('update', '');

      watcher.add(filePaths[0]);
      watcher.on('change', (event, thisPath) => {
        fs.copyFile(filePaths[0], publicImgPath, (err) => {
          if (err) throw err;
          console.log('image was copied to temp folder.');
        });

        let fileInfo = {
          tempFileName: filename,
        };
        let data = JSON.stringify(fileInfo, null, 2);
        fs.writeFileSync(path.join(dir, 'filesInfo.json'), data);

        io.emit('update', '');
      });

      return filePaths[0];
    }
  });

  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    // Código copiado de: https://stackoverflow.com/questions/27072866/how-to-remove-all-files-from-directory-without-removing-directory-in-node-js
    var dir = path.join(__dirname, 'public');
    let publicTempFolder = path.join(dir, 'temp');

    fs.readdir(publicTempFolder, (err, files) => {
      if (err) throw err;

      for (const file of files) {
        fs.unlink(path.join(publicTempFolder, file), (err) => {
          if (err) throw err;
        });
      }
    });

    app.quit();
  }
});
