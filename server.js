const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const fs = require('fs');

const multer  = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

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

app.use('/uploads', cors(), express.static('uploads'));
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

  socket.on('join', (uid) => {
    db.query('SELECT * FROM licenses WHERE uid = ?', [uid], (err, results) => {
      if (err) {
        console.error(err);
        return;
      }
      if (results.length === 0 || !results[0].is_active || new Date(results[0].expiration_date) < new Date()) {
        socket.emit('invalid-uid-license', { uid, message: 'UID or license is invalid' });
        return;
      }
      socket.join(uid);
      socket.emit('joined', { uid });
    });
  });


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
    const targetUid = socket.uid;
    if (targetUid) {
      socket.leave(targetUid);
      delete clients[targetUid];
    }
  });
});


app.get('/notify', (req, res) => {
  io.emit('test-completed', {
    message: 'Тест завершен' 
  });
  res.send('Уведомление отправлено');
});

// Маршрут для регистрации пользователя
app.post('/userregister', (req, res) => {
  const { email, username, phone, password } = req.body;

  // Проверка наличия обязательных полей в запросе
  if (!email || !username || !phone || !password) {
    return res.status(400).json({ error: 'Не все поля были заполнены' });
  }

  // Добавление пользователя в базу данных
  db.query(
    'INSERT INTO users (email, username, phone_number, password) VALUES (?, ?, ?, ?)',
    [email, username, phone, password],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Ошибка регистрации пользователя' });
      }
      return res.status(200).json({ message: 'Пользователь успешно зарегистрирован' });
    }
  );
});

// Маршрут для аутентификации пользователя
app.post('/userlogin', (req, res) => {
  const { email, password } = req.body;

  // Проверка наличия обязательных полей в запросе
  if (!email || !password) {
    return res.status(400).json({ error: 'Не все поля были заполнены' });
  }

  // Поиск пользователя в базе данных по email и паролю
  db.query(
    'SELECT id FROM users WHERE email = ? AND password = ?',
    [email, password],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Ошибка аутентификации пользователя' });
      }

      if (results.length === 0) {
        return res.status(401).json({ error: 'Неверные учетные данные' });
      }

      const userId = results[0].id; // Получение идентификатора пользователя

      // Возвращаем информацию об успешной аутентификации вместе с userId
      return res.status(200).json({ message: 'Пользователь успешно вошел в систему', userId });
    }
  );
});

app.post('/check-uid-license', (req, res) => {
  const { uid } = req.body;
  // Используем объект db для выполнения запроса к базе данных
  db.query('SELECT * FROM licenses WHERE uid = ?', [uid], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    if (results.length === 0) {
      res.status(404).json({ error: 'UID not found' });
      return;
    }
    const license = results[0];
    if (!license.is_active || new Date(license.expiration_date) < new Date()) {
      res.status(403).json({ error: 'License is not active or has expired' });
      return;
    }
    res.json({ message: 'UID and license are valid' });
  });
});




const moment = require('moment');

// Маршрут для покупки лицензии
app.post('/purchaseLicense', (req, res) => {
  const { cardNumber, expirationDate, cvv, userId, selectedPlanIndex } = req.body; // Извлечение данных из тела запроса
  const tariffPlans = [
    { title: 'Базовый', description: 'Описание базового плана', days: 30, price: 450 },
    { title: 'Стандартный', description: 'Описание стандартного плана', days: 90, price: 1350 },
    { title: 'Премиум', description: 'Описание премиум плана', days: 365, price: 5400 },
  ];

  // Проверка наличия всех необходимых данных о карте, userId и выбранном плане
  if (!cardNumber || !expirationDate || !cvv || !userId || selectedPlanIndex === undefined) {
    return res.status(400).json({ error: 'Пожалуйста, заполните все поля карты, userId и выберите тарифный план' });
  }

  // Здесь должна быть логика проверки данных карты (например, валидация номера карты, проверка срока действия и т. д.)

  // Если userId не определен, возвращаем ошибку
  if (!userId) {
    return res.status(401).json({ error: 'Пользователь не аутентифицирован' });
  }

  // Получаем информацию о выбранном тарифном плане
  const selectedPlan = tariffPlans[selectedPlanIndex];

  // Получаем текущую дату
  const currentDate = moment();

  // Добавляем количество дней из выбранного плана к текущей дате для определения срока окончания лицензии
  const licenseExpirationDate = currentDate.clone().add(selectedPlan.days, 'days');

  const uid = generateUniqueUid(7); 

  // Добавление новой лицензии в базу данных
  db.query(
    'INSERT INTO licenses (user_id, uid, expiration_date) VALUES (?, ?, ?)',
    [userId, uid, licenseExpirationDate.format('YYYY-MM-DD')],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Ошибка создания лицензии' });
      }

      // Возвращаем информацию о созданной лицензии
      return res.status(200).json({ message: 'Лицензия успешно создана', uid });
    }
  );
});

// Маршрут для продления лицензии
app.post('/renewLicense', (req, res) => {
  const { cardNumber, expirationDate, cvv, userId, selectedPlanIndex } = req.body;

  // Проверка наличия всех необходимых данных о карте, userId и selectedPlanIndex
  if (!cardNumber || !expirationDate || !cvv || !userId || selectedPlanIndex === undefined) {
    return res.status(400).json({ error: 'Пожалуйста, заполните все поля карты, userId и selectedPlanIndex' });
  }

  // Определение массива тарифных планов
  const tariffPlans = [
    { title: 'На месяц', description: 'Продлите лицензию на один месяц.', days: 30, price: 450 },
    { title: 'На 3 месяца', description: 'Продлите лицензию на три месяца.', days: 90, price: 1350 },
    { title: 'На год', description: 'Продлите лицензию на год.', days: 365, price: 5400 },
  ];

  // Получение текущей даты
  const currentDate = moment();

  // Получение информации о лицензии пользователя из базы данных
  db.query(
    'SELECT expiration_date FROM licenses WHERE user_id = ? AND is_active = true',
    userId,
    (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Ошибка при получении информации о лицензии пользователя' });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: 'Лицензия не найдена' });
      }

      const currentExpirationDate = moment(results[0].expiration_date);

      // Получение количества дней из выбранного тарифного плана
      const selectedPlan = tariffPlans[selectedPlanIndex];
      const licenseDays = selectedPlan.days;

      // Вычисление новой даты истечения лицензии на основе текущей даты и выбранного тарифного плана
      const newExpirationDate = currentExpirationDate.clone().add(licenseDays, 'days');

      // Обновление существующей записи в базе данных с новой датой истечения лицензии
      db.query(
        'UPDATE licenses SET expiration_date = ? WHERE user_id = ? AND is_active = true',
        [newExpirationDate.format('YYYY-MM-DD'), userId],
       (err, results) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Ошибка продления лицензии' });
          }

          // Возвращение информации о продленной лицензии
          return res.status(200).json({ message: 'Лицензия успешно продлена', expiration_date: newExpirationDate.format('YYYY-MM-DD') });
        }
      );
    }
  );
});

function generateUniqueUid(length) {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let uid = '';
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charactersLength);
    uid += characters[randomIndex];
  }

  // Проверяем, что сгенерированный UID уникален
  if (Object.values(clients).some(client => client.uid === uid)) {
    // Если не уникален, рекурсивно вызываем функцию снова
    return generateUniqueUid(length);
  }

  return uid;
}

// Обработчик POST запроса для загрузки аватара
app.post('/uploadAvatar/:userId', upload.single('avatar'), (req, res) => {
  const userId = req.params.userId;
  const avatarFile = req.file;

  if (!avatarFile) {
    res.status(400).send('No file uploaded');
    return;
  }

  // Обновляем URL аватара в базе данных
  const avatarUrl = 'http://62.217.182.138:3000/uploads/' + avatarFile.originalname;
  const sql = 'UPDATE users SET avatar_url = ? WHERE id = ?';
  db.query(sql, [avatarUrl, userId], (err, result) => {
    if (err) {
      throw err;
    }
    console.log('Avatar URL updated');
    res.status(200).json({ avatarUrl }); // Возвращаем URL аватара в качестве ответа
  });
});

// Маршрут для получения аватара пользователя
app.get('/getAvatar/:userId', (req, res) => {
  const userId = req.params.userId;

  // Получаем URL аватара из базы данных
  const sql = 'SELECT avatar_url FROM users WHERE id = ?';
  db.query(sql, [userId], (err, result) => {
    if (err) {
      throw err;
    }

    if (result.length === 0 || !result[0].avatar_url) {
      // Если пользователь не найден или у него нет аватара, возвращаем ошибку 404
      res.status(404).send('Avatar not found');
      return;
    }

    const avatarUrl = result[0].avatar_url;
    res.status(200).json({ avatarUrl }); // Возвращаем URL аватара в качестве ответа
  });
});


app.get('/user/:userId', (req, res) => {
  const userId = req.params.userId;

  // Запрос к базе данных для получения информации о пользователе
  db.query('SELECT * FROM users WHERE id = ?', userId, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Ошибка при получении информации о пользователе' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userInfo = {
      id: results[0].id,
      username: results[0].username,
      email: results[0].email,
      phone_number: results[0].phone_number,
      created_at: results[0].created_at,
    };

    return res.status(200).json(userInfo);
  });
});

// Маршрут для проверки статуса лицензии пользователя
app.get('/licenseStatus/:userId', (req, res) => {
  const userId = req.params.userId;

  // Запрос к базе данных для получения информации о статусе лицензии пользователя
  db.query('SELECT * FROM licenses WHERE user_id = ? AND is_active = true', userId, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Ошибка при проверке статуса лицензии' });
    }

    if (results.length === 0) {
      return res.status(404).json({ active: false, message: 'Лицензия не активна' });
    }

    const licenseInfo = {
      active: true,
      expiration_date: results[0].expiration_date,
      // Здесь вы можете добавить другие необходимые данные о лицензии
    };

    return res.status(200).json(licenseInfo);
  });
});

app.get('/licenseInfo/:userId', (req, res) => {
  const userId = req.params.userId;

  db.query('SELECT uid, DATE_FORMAT(expiration_date, "%Y-%m-%dT%H:%i:%s.000Z") as expiration_date FROM licenses WHERE user_id = ?', userId, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Ошибка при получении информации о лицензии' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Лицензия не найдена' });
    }

    const licenseInfo = {
      uid: results[0].uid,
      expiration_date: results[0].expiration_date,
    };

    return res.status(200).json(licenseInfo);
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});