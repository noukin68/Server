const express = require('express')
const mysql = require('mysql')
const cors = require('cors')
const https = require('https')
const socketIo = require('socket.io')
const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid')
const crypto = require('crypto')
const bodyParser = require('body-parser')
const fs = require('fs')
const nodemailer = require('nodemailer')

// Загрузка сертификата сервера
const serverCert = fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'))

// Загрузка ключа сервера
const serverKey = fs.readFileSync(path.join(__dirname, 'cert', 'key.pem'))

// Загрузка корневого сертификата
const rootCert = fs.readFileSync(path.join(__dirname, 'cert', 'cloudflare.crt'))

// Создание опций для проверки цепочки сертификатов
const options = {
	cert: serverCert,
	key: serverKey,
	ca: [rootCert],
	rejectUnauthorized: true,
}

https
	.createServer(options, function (req, res) {
		res.writeHead(200, { 'Content-Type': 'text/plain' })
		res.end('Helo World\n')
	})
	.listen(443, '62.217.182.138')
console.log('Server running at https://62.217.182.138')
