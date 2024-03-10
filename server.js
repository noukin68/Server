const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

//--Родительский контроль--//

const clients = {};

io.on('connection', (socket) => {
  console.log('Новый клиент подключен');
  const uid = Date.now().toString();
  socket.uid = uid;
  clients[uid] = socket;
  socket.emit('uid', uid);

  socket.on('command', (command) => {
    const targetUid = command.uid;
    const action = command.action;
    const targetSocket = clients[targetUid];
    if (!targetSocket) {
      socket.emit('error', 'UID not found');
      return;
    }
    targetSocket.emit('action', action);
  });

  socket.on('time-received', (data) => {
    const { uid, timeInSeconds } = data;
    const targetSocket = clients[uid];
    if (!targetSocket) {
      socket.emit('error', 'UID not found');
      return;
    }
    targetSocket.emit('time-received', timeInSeconds);
  });


  socket.on('check_uid', (uid) => {
    const exists = clients[uid] !== undefined;
    socket.emit('uid_check_result', { uid, exists });
  });

  socket.on('disconnect', () => {
    console.log('Клиент отключен');
    delete clients[socket.uid];
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});