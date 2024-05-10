const express = require('express')
const app = express()
const cors = require('cors')

// Middleware
app.use(cors()) // Разрешить cross-origin запросы
app.use(express.json()) // Для парсинга JSON-данных из тела запроса

// Маршруты
app.get('/api/data', (req, res) => {
	// Обработка запроса и отправка ответа
	res.json({ message: 'Hello from API' })
})

app.post('/api/data', (req, res) => {
	// Получение данных из тела запроса
	const data = req.body

	// Обработка данных и отправка ответа
	res.json({ message: 'Data received', data })
})

// Обработка ошибок
app.use((err, req, res, next) => {
	console.error(err.stack)
	res.status(500).json({ message: 'Something went wrong' })
})

// Запуск сервера
const PORT = 3000
const HOST = '62.217.182.138'

app.listen(PORT, HOST, () => {
	console.log('API server running on http://${HOST}:${PORT}')
})
