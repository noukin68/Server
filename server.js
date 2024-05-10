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

const options = {
	key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem')),
	cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem')),
}

https
	.createServer(options, function (req, res) {
		res.writeHead(200, { 'Content-Type': 'text/plain' })
		res.end('Hello World\n')
	})
	.listen(8080, '62.217.182.138')
console.log('Server running at https://62.217.182.138:8080')
