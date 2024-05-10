const express = require('express')
const app = express()
const cors = require('cors')
const https = require('https')
const fs = require('fs')
const path = require('path')

// Настройка CORS
app.use(cors())

// Для парсинга JSON-данных из тела запроса
app.use(express.json())

// Путь к SSL-сертификатам
const certPath = path.join(__dirname, 'certs')

// Загрузка SSL-сертификатов
const serverCert = fs.readFileSync(path.join(certPath, 'cert.pem'))
const serverKey = fs.readFileSync(path.join(certPath, 'key.pem'))
const cloudflareRootCert = fs.readFileSync(
	path.join(certPath, 'cloudflare.crt')
)

// Создание HTTPS-сервера
const httpsServer = https.createServer(
	{
		cert: serverCert,
		key: serverKey,
		ca: [cloudflareRootCert],
		rejectUnauthorized: true,
	},
	app
)

// Запуск HTTPS-сервера на порту 3000 и IP-адресе 62.217.182.138
httpsServer.listen(3000, '62.217.182.138', () => {
	console.log('API server running on https://62.217.182.138:3000')
})

// Пример маршрута
app.get('/api/data', (req, res) => {
	// Обработка запроса и отправка ответа
	res.json({ message: 'Hello from API' })
})
