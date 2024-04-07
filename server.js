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
const nodemailer = require('nodemailer');

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

app.post('/clients', (req, res) => {
  const { email, pass } = req.body;

  // Insert the new client into the database
  const query = 'INSERT INTO clients (email, pass) VALUES (?, ?)';
  connection.query(query, [email, pass], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error adding client');
    } else {
      console.log(`Added client with ID: ${results.insertId}`);
      res.status(201).send(`Added client with ID: ${results.insertId}`);
    }
  });
});

//Вход администратора
app.post('/login', (req, res) => {
  const { login, password } = req.body;

  // Проверяем, что переданы оба поля логина и пароля
  if (!login || !password) {
    return res.status(400).json({ message: 'Введите логин и пароль' });
  }

  // Проверяем, является ли пользователь администратором
  db.query('SELECT * FROM teachers WHERE login = ? AND password = ?', [login, password], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: 'Неверные учетные данные или не являетесь администратором' });
    }

    // Авторизация успешна
    res.status(200).json({ message: 'Авторизация успешна' });
  });
});

// Получение списка одобренных студентов
app.get('/approved_students', (req, res) => {
  db.query('SELECT * FROM students WHERE status = ?', ['approved'], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    res.status(200).json(results);
  });
});

app.get('/students/:id?', (req, res) => {
  const { id } = req.params;

  if (id) {
    // If an ID is provided, fetch a specific student by ID
    db.query('SELECT * FROM students WHERE id = ?', [id], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'Студент не найден' });
      }

      res.status(200).json(results[0]); // Assuming 'id' is a unique field, return the first result
    });
  } else {
    // If no ID is provided, fetch all students
    db.query('SELECT * FROM students', (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'Студенты не найдены' });
      }

      res.status(200).json(results);
    });
  }
});

app.delete('/students/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM students WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Студент не найден' });
    }
    res.status(200).json({ message: 'Студент успешно удален' });
  });
});


//Отправка запроса от студента
app.post('/send_request', (req, res) => {
  const { studentId } = req.body;

  // Проверяем, что передан номер зачетки студента
  if (!studentId) {
    return res.status(400).json({ message: 'Введите номер зачетки студента' });
  }

  const teacherId = 1; // Идентификатор преподавателя, к которому отправляется запрос

  // Проверяем, существует ли студент с указанным номером зачетки
  db.query('SELECT * FROM students WHERE student_id = ?', [studentId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    // Если студента нет, создаем новую запись с указанным номером зачетки и статусом "pending"
    if (results.length === 0) {
      db.query('INSERT INTO students (student_id, status) VALUES (?, ?)', [studentId, 'pending'], (err, insertResult) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Ошибка сервера' });
        }

        const studentInsertId = insertResult.insertId;

        // Добавляем запись о запросе в таблицу student_requests
        db.query('INSERT INTO student_requests (student_id, teacher_id) VALUES (?, ?)', [studentInsertId, teacherId], (err, insertRequestResult) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Ошибка сервера' });
          }

          // Отправляем ответ с информацией о запросе и сообщением о том, что запрос отправлен
          res.status(203).json({ message: 'Запрос отправлен' });
        });
      });
    } else {
      // Если студент уже существует, отправляем сообщение, что запрос от данного студента уже существует
      return res.status(210).json({ message: 'Запрос от данного студента уже существует' });
    }
  });
});

//Вход студента
app.post('/student_login', (req, res) => {
  const { studentId } = req.body;

  // Проверяем, что передан номер зачетки студента
  if (!studentId) {
    return res.status(400).json({ message: 'Введите номер зачетки студента' });
  }

  // Проверяем, существует ли студент с указанным номером зачетки и его статус
  db.query('SELECT * FROM students WHERE student_id = ?', [studentId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    // Если студента нет или у него статус "rejected", отправляем сообщение, что вход запрещен
    if (results.length === 0 || results[0].status === 'rejected') {
      return res.status(403).json({ message: 'Вход запрещен' });
    } else if (results[0].status === 'approved') {
      // Если у студента статус "approved", отправляем сообщение, что вход разрешен
      return res.status(200).json({ message: 'Вход разрешен' });
    } else {
      // Если статус студента "pending", отправляем сообщение, что запрос еще не рассмотрен
      return res.status(202).json({ message: 'Запрос еще не рассмотрен' });
    }
  });
});

// Получение списка запросов
app.get('/admin/requests', (req, res) => {
  db.query('SELECT id, (SELECT student_id FROM students WHERE students.id = student_requests.student_id) AS student_id, teacher_id FROM student_requests', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    const requests = results.map((row) => {
      return {
        id: row.id,
        studentId: row.student_id,
        teacherId: row.teacher_id
      };
    });

    res.status(200).json(requests);
  });
});




//Одобрение запроса
app.post('/admin/requests/:requestId/approve', (req, res) => {
  const { requestId } = req.params;

  // Обновление статуса в таблице "student_requests" и связанных данных в таблице "students"
  const query = `UPDATE student_requests AS sr
    JOIN students AS s ON sr.student_id = s.id
    SET sr.status = "approved", s.status = "approved"
    WHERE sr.id = ?`;

  db.query(query, [requestId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Запрос не найден' });
    }

    // Удаление записи из таблицы "student_requests"
    db.query('DELETE FROM student_requests WHERE id = ?', [requestId], (err, deleteResult) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }

      res.status(200).json({ message: 'Request approved. Student status updated. Request deleted.' });
    });
  });
});

// Отклонение запроса
app.post('/admin/requests/:requestId/reject', (req, res) => {
  const { requestId } = req.params;

  // Обновление статуса в таблице "student_requests" и связанных данных в таблице "students"
  const query = `
    UPDATE student_requests AS sr
    JOIN students AS s ON sr.student_id = s.id
    SET sr.status = "rejected", s.status = "rejected"
    WHERE sr.id = ?`;

  db.query(query, [requestId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Запрос не найден' });
    }

    // Удаление записи из таблицы "student_requests"
    db.query('DELETE FROM student_requests WHERE id = ?', [requestId], (err, deleteResult) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }

      res.status(200).json({ message: 'Request rejected. Student status updated. Request deleted.' });
    });
  });
});

//Получение списка лекций
app.get('/lectures', (req, res) => {
  db.query('SELECT id, title, description, difficulty FROM lectures', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    const lectures = results.map((row) => {
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        difficulty: row.difficulty,
      };
    });

    res.status(200).json(lectures);
  });
});


// Добавление новой лекции
app.post('/addLecture', (req, res) => {
  const { title, description, difficulty } = req.body;

  // Проверяем, что переданы все поля
  if (!title || !description || !difficulty) {
    return res.status(400).json({ message: 'Введите название, описание и сложность лекции' });
  }

  // Проверяем корректность значения difficulty
  const validDifficulties = ['Начинающий', 'Средний', 'Продвинутый'];
  if (!validDifficulties.includes(difficulty)) {
    return res.status(400).json({ message: 'Указана недопустимая сложность' });
  }

  // Добавляем запись о лекции в таблицу lectures
  db.query('INSERT INTO lectures (title, description, difficulty, current_id) VALUES (?, ?, ?, ?)', [title, description, difficulty, null], (err, insertResult) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    const lectureId = insertResult.insertId;

    // Обновляем колонку current_id для сохранения идентификатора лекции
    db.query('UPDATE lectures SET current_id = ? WHERE id = ?', [lectureId, lectureId], (err, updateResult) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }

      // Получаем информацию о добавленной лекции
      db.query('SELECT * FROM lectures WHERE id = ?', [lectureId], (err, lectureResult) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Ошибка сервера' });
        }

        if (lectureResult.length === 0) {
          return res.status(404).json({ message: 'Лекция не найдена' });
        }

        const lecture = lectureResult[0];

        // Отправляем ответ с информацией о добавленной лекции
        res.status(200).json(lecture);
      });
    });
  });
});

// Получение информации о конкретной лекции
app.get('/lectures/:lectureId', (req, res) => {
  const lectureId = req.params.lectureId;

  // Проверяем, что передан корректный идентификатор лекции
  if (!lectureId) {
    return res.status(400).json({ message: 'Укажите корректный идентификатор лекции' });
  }

  // Запрашиваем информацию о лекции из базы данных по идентификатору
  db.query('SELECT id, title, description, difficulty FROM lectures WHERE id = ?', [lectureId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Лекция не найдена' });
    }

    const lecture = results[0];

    res.status(200).json(lecture);
  });
});

//Удаление лекции
app.delete('/lectures/:lectureId', (req, res) => {
  const lectureId = req.params.lectureId;

  // Проверяем, что передан корректный идентификатор лекции
  if (!lectureId) {
    return res.status(400).json({ message: 'Укажите корректный идентификатор лекции' });
  }

  // Удаляем запись о лекции из таблицы lectures
  db.query('DELETE FROM lectures WHERE id = ?', [lectureId], (err, deleteResult) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ message: 'Лекция не найдена' });
    }

    res.status(200).json({ message: 'Лекция успешно удалена' });
  });
});


// Редактирование лекции
app.put('/lectures/:lectureId', (req, res) => {
  const lectureId = req.params.lectureId;
  const { title, description, difficulty } = req.body;

  // Проверяем, что переданы все поля
  if (!title || !description || !difficulty) {
    return res.status(400).json({ message: 'Введите название, описание и сложность лекции' });
  }

  // Проверяем, что значение lectureId не равно null
  if (!lectureId) {
    return res.status(400).json({ message: 'Укажите корректный идентификатор лекции' });
  }

  // Обновляем запись о лекции в таблице lectures
  db.query(
    'UPDATE lectures SET title = ?, description = ?, difficulty = ? WHERE current_id = ?',
    [title, description, difficulty, lectureId],
    (err, updateResult) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Ошибка сервера' });
      }

      if (updateResult.affectedRows === 0) {
        return res.status(404).json({ message: 'Лекция не найдена' });
      }

      // Получаем информацию о обновленной лекции
      db.query('SELECT * FROM lectures WHERE id = ?', [lectureId], (err, lectureResult) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Ошибка сервера' });
        }

        if (lectureResult.length === 0) {
          return res.status(404).json({ message: 'Лекция не найдена' });
        }

        const lecture = lectureResult[0];

        // Отправляем ответ с информацией о обновленной лекции
        res.status(200).json(lecture);
      });
    }
  );
});

// Получите все вопросы викторины quizsyntax
app.get('/quizsyntax', (req, res) => {
  const sql = 'SELECT * FROM quizsyntax';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizsyntax
app.get('/quizsyntax/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizsyntax WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quiztypeobject
app.get('/quiztypeobject', (req, res) => {
  const sql = 'SELECT * FROM quiztypeobject';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quiztypeobject
app.get('/quiztypeobject/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quiztypeobject WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quiztypeoperator
app.get('/quiztypeoperator', (req, res) => {
  const sql = 'SELECT * FROM quiztypeoperator';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quiztypeoperator
app.get('/quiztypeoperator/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quiztypeoperator WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quizifoperator
app.get('/quizifoperator', (req, res) => {
  const sql = 'SELECT * FROM quizifoperator';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizifoperator
app.get('/quizifoperator/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizifoperator WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quizcycle
app.get('/quizcycle', (req, res) => {
  const sql = 'SELECT * FROM quizcycle';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizcycle
app.get('/quizcycle/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizcycle WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quizstr
app.get('/quizstr', (req, res) => {
  const sql = 'SELECT * FROM quizstr';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizstr
app.get('/quizstr/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizstr WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quizlist
app.get('/quizlist', (req, res) => {
  const sql = 'SELECT * FROM quizlist';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizlist
app.get('/quizlist/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizlist WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quizdictionary
app.get('/quizdictionary', (req, res) => {
  const sql = 'SELECT * FROM quizdictionary';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizdictionary
app.get('/quizdictionary/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizdictionary WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quizsets
app.get('/quizsets', (req, res) => {
  const sql = 'SELECT * FROM quizsets';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizsets
app.get('/quizsets/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizsets WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quizfunction
app.get('/quizfunction', (req, res) => {
  const sql = 'SELECT * FROM quizfunction';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizfunction
app.get('/quizfunction/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizfunction WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quizexceptions
app.get('/quizexceptions', (req, res) => {
  const sql = 'SELECT * FROM quizexceptions';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizexceptions
app.get('/quizexceptions/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizexceptions WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quizfile
app.get('/quizfile', (req, res) => {
  const sql = 'SELECT * FROM quizfile';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizfile
app.get('/quizfile/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizfile WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quizmodule
app.get('/quizmodule', (req, res) => {
  const sql = 'SELECT * FROM quizmodule';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizmodule
app.get('/quizmodule/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizmodule WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

// Получите все вопросы викторины quizregular
app.get('/quizregular', (req, res) => {
  const sql = 'SELECT * FROM quizregular';
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result);
  });
});

// Получите вопрос викторины по ID quizregular
app.get('/quizregular/:id', (req, res) => {
  const quizId = req.params.id;
  const sql = `SELECT * FROM quizregular WHERE id = ${quizId}`;
  db.query(sql, (err, result) => {
    if (err) {
      throw err;
    }
    res.json(result[0]);
  });
});

//Получение списка названия тестов
app.get('/tests', (req, res) => {
  db.query('SELECT test_id, title FROM tests', (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    const tests = results.map((row) => {
      return {
        id: row.id,
        title: row.title,
      };
    });

    res.status(200).json(tests);
  });
});

//--Навигид--//

//Вход пользователя по номеру телефона
app.post('/loginPhone', (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: 'Не указан номер телефона' });
  }

  // Проверяем, есть ли пользователь с указанным номером телефона в базе данных
  db.query(
    'SELECT * FROM phonenumbers WHERE phoneNumber = ?',
    [phoneNumber],
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Ошибка базы данных' });
      }

      // Если пользователь не найден, возвращаем сообщение о регистрации
      if (results.length === 0) {
        return res.status(401).json({ message: 'Пользователь не найден. Пожалуйста, зарегистрируйтесь.' });
      }

      // Вход пользователя
      res.status(200).json({ message: 'Вход выполнен успешно' });
    }
  );
});

//Регистрация пользователя
app.post('/registerPhone', (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: 'Не указан номер телефона' });
  }

  // Добавляем пользователя в базу данных
  db.query(
    'INSERT INTO phonenumbers (phoneNumber) VALUES (?)',
    [phoneNumber],
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Ошибка базы данных' });
      }

      //Регистрация пользователя
      return res.status(200).json({ message: 'Регистрация успешно завершена' });
    }
  );
});

// Маршрут для добавления точки в базу данных
app.post('/addPoint', async (req, res) => {
const { latitude, longitude, name } = req.body;

try {
  db.query(
    'INSERT INTO points (latitude, longitude, name) VALUES (?, ?, ?)',
    [latitude, longitude, name],
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Ошибка базы данных' });
      }

      res.status(200).json({ id: result.insertId });
    }
  );
} catch (error) {
  console.error('Error inserting data:', error);
  res.status(500).json({ error: 'An error occurred while inserting data.' });
}
});

// Маршрут для получения всех точек  из базы данных
app.get('/getPoints', async (req, res) => {
try {
  db.query(
    'SELECT * FROM points',
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: 'Ошибка базы данных' });
      }

      return res.status(200).json(rows);
    }
  );
} catch (error) {
  console.error('Error fetching data:', error);
  res.status(400).json({ error: 'An error occurred while fetching data.' });
}
});

// Маршрут для получения точки
app.get('/getPointPes', async (req, res) => {
const { latitude, longitude } = req.body;

db.query(
  'SELECT * FROM points WHERE latitude = ? AND longitude = ?',
    [latitude, longitude],
  (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Ошибка базы данных' });
    }

    return res.status(200).json({ message: 'Точка успешно получена' });
  }
);
});

//--Родительский контроль--//

const clients = {
  flutter: {},
  wpf: {}
};

io.on('connection', (socket) => {

  socket.on('join', (data) => {
      const { uid, type } = data;
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
          socket.emit('joined', { uid, type });
      });
  });

  socket.on('flutter-connected', ({ uid }) => {
      clients.flutter[uid] = socket.id;
      io.emit('connection-status', { uid, connected: true, type: 'flutter' });
  });

  socket.on('flutter-disconnected', ({ uid }) => {
    clients.flutter[uid] = socket.id;
    io.emit('connection-status', { uid, connected: false, type: 'flutter' });
    delete clients.flutter[uid];
});

  socket.on('wpf-connected', ({ uid }) => {
      clients.wpf[uid] = socket.id;
      io.emit('connection-status', { uid, connected: true, type: 'wpf' });
  });

  socket.on('wpf-disconnected', ({ uid }) => {
    clients.wpf[uid] = socket.id;
    io.emit('connection-status', { uid, connected: false, type: 'wpf' });
    delete clients.wpf[uid];
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
    const targetSocket = clients[targetUid];
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

  socket.on('restart-timer', (targetUid) => {
    console.log('Запрос на перезапуск таймера');
    if (!io.sockets.adapter.rooms.has(targetUid)) {
        socket.emit('error', 'UID not found');
        return;
    }
    if (timerStopped) {
      console.log('Таймер был остановлен, перезапуск отменен');
      return;
    }
    if(!timerStopped){
      io.to(targetUid).emit('time-received', { uid: targetUid, timeInSeconds: clients[targetUid].timeInSeconds });
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

  socket.on('disconnect-uid', (uid) => {
    const targetUid = uid;
    if (!io.sockets.adapter.rooms.has(targetUid)) {
      socket.emit('error', 'UID not found');
      return;
    }
    io.to(targetUid).emit('disconnect-action');
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

app.post('/check-uid-license-wpf', (req, res) => {
  const { uid } = req.body;

  // Запрос к базе данных для получения информации о лицензии по UID
  db.query('SELECT * FROM licenses WHERE uid = ?', [uid], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
    if (results.length === 0) {
      // UID не найден в таблице
      res.status(404).json({ error: 'UID not found' });
      return;
    }
    const license = results[0];
    if (!license.is_active || new Date(license.expiration_date) < new Date()) {
      // Лицензия не активна или истек срок ее действия
      res.status(403).json({ error: 'License is not active or has expired' });
      return;
    }
    // UID и лицензия действительны
    res.json({ message: 'UID and license are valid' });
  });
});




const moment = require('moment');

app.post('/purchaseLicense', (req, res) => {
  const {userId, selectedPlanIndex } = req.body;
  const tariffPlans = [
    { title: 'Базовый', days: 30, price: 450 },
    { title: 'Стандартный', days: 90, price: 1350 },
    { title: 'Премиум', days: 365, price: 5400 },
  ];

  // Проверка наличия всех необходимых данных о карте, userId и выбранном плане
  if (!userId || selectedPlanIndex === undefined) {
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

  // Получаем email пользователя из базы данных
  db.query('SELECT email FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Ошибка получения email пользователя' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userEmail = results[0].email;

    // Добавление новой лицензии в базу данных
    db.query(
      'INSERT INTO licenses (user_id, uid, expiration_date) VALUES (?, ?, ?)',
      [userId, uid, licenseExpirationDate.format('YYYY-MM-DD')],
      (err, results) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Ошибка создания лицензии' });
        }

        // Отправка письма с ссылками на скачивание приложения
        const mailOptions = {
          from: 'noukin68@mail.ru',
          to: userEmail,
          subject: 'Спасибо за покупку лицензии',
          html: `
            <p>Спасибо за покупку лицензии на ${selectedPlan.days} дней.</p>
            <p>Вы можете скачать приложение по следующим ссылкам:</p>
            <ul>
              <li><a href="https://drive.google.com/file/d/1YiVTvAWPweKlsw3hS7ugv4aodlTuAdOQ/view?usp=sharing">Скачать для Windows</a></li>
              <li><a href="https://drive.google.com/file/d/1GuuTZkjKbry6QazoDv_AgF3jyIZ2izxk/view?usp=sharing">Скачать для Android</a></li>
            </ul>
          `
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error(error);
          } else {
            console.log(`Email sent: ${info.response}`);
          }
        });

        // Возвращаем информацию о созданной лицензии
        return res.status(200).json({ message: 'Лицензия успешно создана', uid });
      }
    );
  });
});

// Маршрут для продления лицензии
app.post('/renewLicense', (req, res) => {
  const {userId, selectedPlanIndex } = req.body;

  // Проверка наличия всех необходимых данных о карте, userId и selectedPlanIndex
  if (!userId || selectedPlanIndex === undefined) {
    return res.status(400).json({ error: 'Пожалуйста, заполните все поля карты, userId и selectedPlanIndex' });
  }

  // Определение массива тарифных планов
  const tariffPlans = [
    { title: 'На месяц', days: 30, price: 450 },
    { title: 'На 3 месяца', days: 90, price: 1350 },
    { title: 'На год', days: 365, price: 5400 },
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
      return res.status(500).json({ error: 'Ошибк при проверке статуса лицензии' });
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

const transporter = nodemailer.createTransport({
  host: 'smtp.mail.ru',
  port: 465,
  secure: true,
  auth: {
      user: 'noukin68@mail.ru',
      pass: 'kvrN8geFLRZ3QcqNWj8T'
  }
});

app.post('/sendEmailVerificationCode', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email не указан' });
  }

  try {
    // Проверяем, существует ли email в таблице users
    const existingUser = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Email уже существует' });
    }

    // Проверяем, существует ли email в таблице email_verification
    const existingEmail = await db.query('SELECT * FROM email_verification WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
      return res.status(400).json({ error: 'Email уже существует' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000);

    await db.query('INSERT INTO email_verification (email, code) VALUES (?, ?)', [email, verificationCode]);

    const mailOptions = {
      from: 'noukin68@mail.ru',
      to: email,
      subject: 'Код подтверждения электронной почты',
      text: `Ваш код подтверждения: ${verificationCode}`
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({ message: 'Код подтверждения отправлен' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка отправки кода подтверждения' });
  }
});

app.post('/verifyEmail', async (req, res) => {
  const { email, code } = req.body;

  // Проверка наличия email и code в запросе
  if (!email || !code) {
    return res.status(400).json({ error: 'Email или код не указан' });
  }

  try {
    // Получение кода подтверждения из базы данных
    const verification = await db.query('SELECT * FROM email_verification WHERE email = ?', [email]);

    // Проверка наличия кода подтверждения в базе данных
    if (verification.length === 0) {
      return res.status(400).json({ error: 'Код подтверждения не найден' });
    }

    // Проверка корректности кода подтверждения
    if (verification[0].code !== parseInt(code)) {
      return res.status(400).json({ error: 'Неверный код подтверждения' });
    }

    // Удаление кода подтверждения из базы данных
    await db.query('DELETE FROM email_verification WHERE email = ?', [email]);

    // Обновление статуса подтверждения email в таблице users
    await db.query('UPDATE users SET email_verified = true WHERE email = ?', [email]);

    return res.status(200).json({ message: 'Email подтвержден' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка подтверждения email' });
  }
});



server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});