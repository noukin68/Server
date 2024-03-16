const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

const db = mysql.createPool({
  connectionLimit : 10,
  host: 'marencid.beget.tech',
  user: 'marencid_tech',
  password: 'Root123',
  database: 'marencid_tech',
});

db.query('SELECT 1 + 1 AS solution', function (error, results, fields) {
  if (error) throw error;
  console.log('The solution is: ', results[0].solution);
});

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
  socket.join(uid);

  socket.emit('uid', uid);

  socket.on('command', (command) => {
    const targetUid = command.uid;
    const action = command.action;
    if (!io.sockets.adapter.rooms.has(targetUid)) {
      socket.emit('error', 'UID not found');
      return;
    }
    io.to(targetUid).emit('action', action);
  });

  socket.on('time-received', ({ uid: targetUid, timeInSeconds }) => {
    if (!io.sockets.adapter.rooms.has(targetUid)) {
        socket.emit('error', 'UID not found');
        return;
    }
    if (socket.uid !== targetUid) {
        clients[targetUid] = { timeInSeconds }; // Сохраняем первоначальное время таймера
        io.to(targetUid).emit('time-received', { uid: targetUid, timeInSeconds });
    }
  });

  let timerStopped = false;
  socket.on('stop-timer', ({ uid: targetUid, totalSeconds }) => {
    if (!io.sockets.adapter.rooms.has(targetUid)) {
      socket.emit('error', 'UID not found');
      return;
    }
    if (socket.uid !== targetUid) {

      io.to(targetUid).emit('stop-timer', { uid: targetUid, totalSeconds });
    }
    timerStopped = true;
  });

  socket.on('continue-work', ({ uid: targetUid}) => {
    if (!io.sockets.adapter.rooms.has(targetUid)) {
      socket.emit('error', 'UID not found');
      return;
    }
    if (socket.uid !== targetUid) {

      io.to(targetUid).emit('continue-work', { uid: targetUid});
    }
  });

  socket.on('finish-work', ({ uid: targetUid}) => {
    if (!io.sockets.adapter.rooms.has(targetUid)) {
      socket.emit('error', 'UID not found');
      return;
    }
    if (socket.uid !== targetUid) {

      io.to(targetUid).emit('finish-work', { uid: targetUid});
    }
  });

  socket.on('subject-and-class', ({ uid: targetUid, subject, grade}) => {
    if (!io.sockets.adapter.rooms.has(targetUid)) {
      socket.emit('error', 'UID not found');
      return;
    }
    console.log('Received Subject: ' + subject);
    console.log('Received Class: ' + grade);
    if (socket.uid !== targetUid) {

      io.to(targetUid).emit('selected-subject-and-class', { uid: targetUid, subject, grade});
    }
  });

  socket.on('restart-timer', () => {
    console.log('Запрос на перезапуск таймера');
    if (!io.sockets.adapter.rooms.has(socket.uid)) {
        socket.emit('error', 'UID not found');
        return;
    }
    if(!timerStopped){
      io.to(socket.uid).emit('time-received', { uid: socket.uid, timeInSeconds: clients[socket.uid].timeInSeconds });
    }
  });

  socket.on('restart-time', ({ uid: targetUid, timeInSeconds}) => {
    if (!io.sockets.adapter.rooms.has(targetUid)) {
      socket.emit('error', 'UID not found');
      return;
    }
    if (socket.uid !== targetUid) {

      io.to(targetUid).emit('restart-time', { uid: targetUid, timeInSeconds});
    }
  });

  socket.on('process-data', ({ uid: targetUid, processes }) => {
    if (!io.sockets.adapter.rooms.has(targetUid)) {
      socket.emit('error', 'UID not found');
      return;
    }
    io.to(targetUid).emit('process-data', { uid: targetUid, processes });
  });
  
  
  
  socket.on('timer-finished', () => {
    console.log('Timer finished');
    io.emit('timer-finished');
  });
  
  socket.on('wpf-disconnected', () => {
    io.emit('connection-status', { connected: false });
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

app.get('/notify', (req, res) => {
  io.emit('test-completed', {
    message: 'Тест завершен' 
  });
  res.send('Уведомление отправлено');
});

app.post('/registerParent', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Пожалуйста, укажите имя пользователя, адрес электронной почты и пароль' });
  }

  bcrypt.hash(password, 10, (err, hash) => {
    if (err) {
      console.error('Ошибка хеширования пароля:', err);
      return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }

    db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hash], (err, result) => {
      if (err) {
        console.error('Ошибка регистрации пользователя:', err);
        return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
      }

      db.query('INSERT INTO licenses (email) VALUES (?)', [email], (err, licenseResult) => {
        if (err) {
          console.error('Ошибка добавления лицензии:', err);
          return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
        }

        console.log('Пользователь успешно зарегистрирован');
        res.status(201).json({ message: 'Пользователь успешно зарегистрирован' });
      });
    });
  });
});

app.post('/loginParent', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Пожалуйста, укажите адрес электронной почты и пароль' });
  }

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error('Ошибка поиска пользователя:', err);
      return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: 'Неправильный адрес электронной почты или пароль' });
    }

    bcrypt.compare(password, results[0].password, (err, result) => {
      if (err) {
        console.error('Ошибка сравнения паролей:', err);
        return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
      }

      if (!result) {
        return res.status(401).json({ message: 'Неправильный адрес электронной почты или пароль' });
      }

      return res.status(200).json({ message: 'Авторизация успешна' });
    });
  });
});

app.post('/check-license', (req, res) => {
  const { email } = req.body;

  const query = 'SELECT * FROM licenses WHERE email = ? AND license_key != "default_value"';
  db.query(query, [email], (error, results) => {
    if (error) {
      console.error(error);
      res.status(500).send('Внутренняя ошибка сервера');
    } else {
      if (results.length > 0) {
        res.status(200).send('License valid');
      } else {
        res.status(403).send('License required');
      }
    }
  });
});

app.post('/activate-product', (req, res) => {
  const { email } = req.body;

  const key = crypto.randomBytes(20).toString('hex');

  const query = 'UPDATE licenses SET license_key = ? WHERE email = ?';
  db.query(query, [key, email], (error, results) => {
    if (error) {
      console.error(error);
      res.status(500).send('Внутренняя ошибка сервера');
    } else {
      if (results.affectedRows > 0) {
        res.status(200).json({ message: 'Продукт активирован', licenseKey: key });
      } else {
        res.status(404).send('Электронная почта не найдена');
      }
    }
  });
});


server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});